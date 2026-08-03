/**
 * Seed Aether Games fraud alerts into Elastic Security Serverless.
 * Indexes synthetic documents into .alerts-security.alerts-default.
 *
 * Server-only env (never VITE_*):
 *   SECURITY_ES_URL  — Security project ES URL (preferred)
 *   SECURITY_ES_API_KEY
 * Falls back to ES_URL / ES_API_KEY only if SECURITY_* unset (same project).
 *
 * POST /api/seed-fraud
 * GET  /api/seed-fraud → { configured }
 */
import { randomUUID } from 'node:crypto';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function creds() {
  const url = (process.env.SECURITY_ES_URL || process.env.ES_URL || '').trim().replace(/\/$/, '');
  const apiKey = (process.env.SECURITY_ES_API_KEY || process.env.ES_API_KEY || '').trim();
  const source = process.env.SECURITY_ES_URL
    ? 'SECURITY_ES_URL'
    : process.env.ES_URL
      ? 'ES_URL (fallback — prefer SECURITY_* for the Security project)'
      : null;
  return { url, apiKey, source };
}

function buildAlert({
  ruleName,
  ruleId,
  severity,
  riskScore,
  description,
  user,
  sourceIp,
  region,
  tactics = [],
  techniques = [],
}) {
  const now = new Date().toISOString();
  const docId = randomUUID();
  const ruleUuid = randomUUID();
  const threat =
    tactics.length || techniques.length
      ? [
          {
            framework: 'MITRE ATT&CK',
            ...(tactics[0]
              ? {
                  tactic: {
                    id: tactics[0].id,
                    name: tactics[0].name,
                    reference: `https://attack.mitre.org/tactics/${tactics[0].id}/`,
                  },
                }
              : {}),
            ...(techniques.length
              ? {
                  technique: techniques.map((t) => ({
                    id: t.id,
                    name: t.name,
                    reference: `https://attack.mitre.org/techniques/${t.id.replace('.', '/')}/`,
                  })),
                }
              : {}),
          },
        ]
      : [];

  return {
    '@timestamp': now,
    ecs: { version: '8.11.0' },
    event: {
      kind: 'signal',
      category: ['threat', 'authentication'],
      type: ['indicator'],
      action: 'aether-fraud-sim',
      module: 'aether_games',
      dataset: 'aether.fraud',
      outcome: 'failure',
    },
    message: description,
    user: { name: user },
    source: { ip: sourceIp, geo: { region_name: region } },
    labels: { studio: 'Aether Games', demo: 'vercel-fraud-seed' },
    kibana: {
      alert: {
        rule: {
          name: ruleName,
          rule_id: ruleId,
          uuid: ruleUuid,
          rule_type_id: 'siem.queryRule',
          type: 'query',
          category: 'Custom Query Rule',
          description,
          producer: 'siem',
          consumer: 'siem',
          tags: ['Aether Games', 'Fraud Demo', 'Sample Data'],
          revision: 1,
          parameters: {},
          execution: { uuid: randomUUID() },
        },
        status: 'active',
        workflow_status: 'open',
        workflow_tags: [],
        severity,
        risk_score: riskScore,
        depth: 1,
        reason: `${ruleName} for ${user} from ${sourceIp} (${region})`,
        original_time: now,
        uuid: docId,
        url: '',
        start: now,
        time_range: { gte: now },
        ancestors: [
          {
            id: randomUUID(),
            type: 'event',
            index: 'logs-aether.fraud-default',
            depth: 0,
          },
        ],
      },
      space_ids: ['default'],
      version: '8.15.0',
    },
    ...(threat.length ? { threat } : {}),
  };
}

function gamingFraudAlerts() {
  return [
    buildAlert({
      ruleName: 'Aether — Credential stuffing on account platform',
      ruleId: 'aether-fraud-credential-stuffing',
      severity: 'critical',
      riskScore: 99,
      description: 'Auth failure spike correlated with known bad IP ranges during launch window.',
      user: 'aether-user-88421',
      sourceIp: '203.0.113.44',
      region: 'us-west',
      tactics: [{ id: 'TA0006', name: 'Credential Access' }],
      techniques: [{ id: 'T1110.004', name: 'Credential Stuffing' }],
    }),
    buildAlert({
      ruleName: 'Aether — Multi-account abuse (shared device)',
      ruleId: 'aether-fraud-multi-account',
      severity: 'high',
      riskScore: 84,
      description: '12 new accounts created from shared device fingerprint within 18 minutes.',
      user: 'device-fp-9c2a',
      sourceIp: '198.51.100.17',
      region: 'eu-west',
      tactics: [{ id: 'TA0001', name: 'Initial Access' }],
      techniques: [{ id: 'T1078', name: 'Valid Accounts' }],
    }),
    buildAlert({
      ruleName: 'Aether — Payment fraud (stolen instrument)',
      ruleId: 'aether-fraud-payment',
      severity: 'high',
      riskScore: 88,
      description: 'Checkout velocity anomaly on digital storefront — stolen payment instrument pattern.',
      user: 'buyer-tok-stub',
      sourceIp: '192.0.2.91',
      region: 'us-east',
      tactics: [{ id: 'TA0040', name: 'Impact' }],
      techniques: [{ id: 'T1496', name: 'Resource Hijacking' }],
    }),
    buildAlert({
      ruleName: 'Aether — Session hijack candidate',
      ruleId: 'aether-fraud-session-hijack',
      severity: 'medium',
      riskScore: 61,
      description: 'Impossible travel / geo hop mid-match on session-gateway.',
      user: 'session-sgw-77af',
      sourceIp: '203.0.113.200',
      region: 'apac',
      tactics: [{ id: 'TA0006', name: 'Credential Access' }],
      techniques: [{ id: 'T1539', name: 'Steal Web Session Cookie' }],
    }),
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { url, apiKey, source } = creds();
  const configured = Boolean(url && apiKey);

  if (req.method === 'GET') {
    json(res, 200, {
      configured,
      source,
      host: configured ? url.replace(/^https?:\/\//, '') : null,
      hint: configured
        ? null
        : 'Set SECURITY_ES_URL + SECURITY_ES_API_KEY on Vercel (Security project), then redeploy.',
    });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to seed fraud alerts' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error:
        'SECURITY_ES_URL and SECURITY_ES_API_KEY are not set (server-only). Add them for the Security Serverless project and redeploy.',
    });
    return;
  }

  const alerts = gamingFraudAlerts();
  const ndjson = alerts
    .flatMap((doc) => [
      JSON.stringify({ create: { _index: '.alerts-security.alerts-default' } }),
      JSON.stringify(doc),
    ])
    .join('\n')
    .concat('\n');

  try {
    const upstream = await fetch(`${url}/_bulk?refresh=wait_for`, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        'Content-Type': 'application/x-ndjson',
      },
      body: ndjson,
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      json(res, 502, {
        error: 'Bulk index failed',
        status: upstream.status,
        body: JSON.stringify(body).slice(0, 800),
      });
      return;
    }

    let indexed = 0;
    let errors = 0;
    const firstError = [];
    for (const item of body.items || []) {
      const op = item.create || item.index;
      if (op?.error) {
        errors += 1;
        if (firstError.length < 2) firstError.push(op.error);
      } else indexed += 1;
    }

    json(res, errors && !indexed ? 502 : 200, {
      ok: indexed > 0,
      indexed,
      errors,
      firstError: firstError.length ? firstError : undefined,
      message: `Seeded ${indexed} Aether fraud alerts into Security.`,
      open: 'Security → Alerts (filter tag: Aether Games). Attack Discovery needs an LLM connector + Run after alerts exist.',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
