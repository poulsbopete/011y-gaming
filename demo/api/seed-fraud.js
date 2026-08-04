/**
 * Seed Aether Games fraud alerts (+ entity risk scores) into Elastic Security Serverless.
 *
 * Server-only env (never VITE_*):
 *   SECURITY_ES_URL / SECURITY_ES_API_KEY — required (Security project)
 *   SECURITY_KIBANA_URL — optional; derived from ES URL (.es. → .kb.) when unset
 *   SECURITY_SPACE_IDS — comma-separated Kibana space ids (default: default)
 *
 * POST /api/seed-fraud
 * GET  /api/seed-fraud → { configured, host, spaceIds }
 */
import { randomUUID } from 'node:crypto';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function spaceIds() {
  const raw = (process.env.SECURITY_SPACE_IDS || 'default').trim();
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : ['default'];
}

function kibanaUrlFromEs(esUrl) {
  const explicit = (process.env.SECURITY_KIBANA_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  if (!esUrl) return '';
  return esUrl.replace('.es.', '.kb.');
}

function creds() {
  const url = (process.env.SECURITY_ES_URL || '').trim().replace(/\/$/, '');
  const apiKey = (process.env.SECURITY_ES_API_KEY || '').trim();
  const kibana = kibanaUrlFromEs(url);
  const o11yFallbackSet = Boolean(process.env.ES_URL || process.env.ES_API_KEY);
  return {
    url,
    apiKey,
    kibana,
    source: url ? 'SECURITY_ES_URL' : null,
    o11yFallbackSet,
    spaces: spaceIds(),
  };
}

function looksLikeObservability(url) {
  const host = url.replace(/^https?:\/\//, '').toLowerCase();
  return host.includes('otel-demo') || host.startsWith('otel-');
}

function levelForScore(score) {
  if (score >= 90) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Low';
  return 'Unknown';
}

function buildAlert({
  ruleName,
  ruleId,
  severity,
  riskScore,
  description,
  user,
  host,
  sourceIp,
  region,
  tactics = [],
  techniques = [],
  spaces,
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
    host: { name: host },
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
        reason: `${ruleName} for ${user} / ${host} from ${sourceIp} (${region})`,
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
      space_ids: spaces,
      version: '8.15.0',
    },
    ...(threat.length ? { threat } : {}),
  };
}

function buildRiskDoc({ entityType, name, score, alertCount }) {
  const now = new Date().toISOString();
  const level = levelForScore(score);
  const risk = {
    id_field: `${entityType}.name`,
    id_value: name,
    calculated_level: level,
    calculated_score: score,
    calculated_score_norm: score,
    category_1_count: alertCount,
    category_1_score: score,
    inputs: [],
  };
  return {
    '@timestamp': now,
    [entityType]: { name, risk },
    risk,
  };
}

const FRAUD_CASES = [
  {
    ruleName: 'Aether — Credential stuffing on account platform',
    ruleId: 'aether-fraud-credential-stuffing',
    severity: 'critical',
    riskScore: 99,
    description: 'Auth failure spike correlated with known bad IP ranges during launch window.',
    user: 'aether-user-88421',
    host: 'aether-auth-usw2-01',
    sourceIp: '203.0.113.44',
    region: 'us-west',
    tactics: [{ id: 'TA0006', name: 'Credential Access' }],
    techniques: [{ id: 'T1110.004', name: 'Credential Stuffing' }],
  },
  {
    ruleName: 'Aether — Multi-account abuse (shared device)',
    ruleId: 'aether-fraud-multi-account',
    severity: 'high',
    riskScore: 84,
    description: '12 new accounts created from shared device fingerprint within 18 minutes.',
    user: 'device-fp-9c2a',
    host: 'aether-account-euw1-03',
    sourceIp: '198.51.100.17',
    region: 'eu-west',
    tactics: [{ id: 'TA0001', name: 'Initial Access' }],
    techniques: [{ id: 'T1078', name: 'Valid Accounts' }],
  },
  {
    ruleName: 'Aether — Payment fraud (stolen instrument)',
    ruleId: 'aether-fraud-payment',
    severity: 'high',
    riskScore: 88,
    description: 'Checkout velocity anomaly on digital storefront — stolen payment instrument pattern.',
    user: 'buyer-tok-stub',
    host: 'aether-store-use1-02',
    sourceIp: '192.0.2.91',
    region: 'us-east',
    tactics: [{ id: 'TA0040', name: 'Impact' }],
    techniques: [{ id: 'T1496', name: 'Resource Hijacking' }],
  },
  {
    ruleName: 'Aether — Session hijack candidate',
    ruleId: 'aether-fraud-session-hijack',
    severity: 'medium',
    riskScore: 61,
    description: 'Impossible travel / geo hop mid-match on session-gateway.',
    user: 'session-sgw-77af',
    host: 'aether-session-apac-01',
    sourceIp: '203.0.113.200',
    region: 'apac',
    tactics: [{ id: 'TA0006', name: 'Credential Access' }],
    techniques: [{ id: 'T1539', name: 'Steal Web Session Cookie' }],
  },
];

function gamingFraudAlerts(spaces) {
  return FRAUD_CASES.map((a) => buildAlert({ ...a, spaces }));
}

function gamingRiskDocs() {
  const docs = [];
  for (const c of FRAUD_CASES) {
    docs.push(buildRiskDoc({ entityType: 'user', name: c.user, score: c.riskScore, alertCount: 1 }));
    docs.push(buildRiskDoc({ entityType: 'host', name: c.host, score: Math.max(40, c.riskScore - 8), alertCount: 1 }));
  }
  return docs;
}

async function bulkIndex(esUrl, apiKey, index, docs) {
  const ndjson = docs
    .flatMap((doc) => [JSON.stringify({ create: { _index: index } }), JSON.stringify(doc)])
    .join('\n')
    .concat('\n');
  const upstream = await fetch(`${esUrl}/_bulk?refresh=wait_for`, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: ndjson,
  });
  const body = await upstream.json().catch(() => ({}));
  let indexed = 0;
  let errors = 0;
  const firstError = [];
  for (const item of body.items || []) {
    const op = item.create || item.index;
    if (op?.error) {
      errors += 1;
      if (firstError.length < 2) {
        firstError.push({ type: op.error.type, reason: op.error.reason });
      }
    } else indexed += 1;
  }
  return { ok: upstream.ok, status: upstream.status, indexed, errors, firstError, body };
}

async function kickEntityStore(kibana, apiKey, space) {
  if (!kibana) return { skipped: true, reason: 'no kibana url' };
  const prefix = `/s/${encodeURIComponent(space)}`;
  const headers = {
    Authorization: `ApiKey ${apiKey}`,
    'kbn-xsrf': 'true',
    'x-elastic-internal-origin': 'kibana',
    'Content-Type': 'application/json',
    'Elastic-Api-Version': '2023-10-31',
  };
  const steps = [];

  async function call(name, method, path, body) {
    try {
      const r = await fetch(`${kibana}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await r.text();
      steps.push({ name, status: r.status, body: text.slice(0, 220) });
    } catch (err) {
      steps.push({ name, status: 0, body: err instanceof Error ? err.message : String(err) });
    }
  }

  // Entity Store V2 (legacy /internal/risk_score/engine/* returns 400 on this project).
  await call('enable_store', 'POST', `${prefix}/api/entity_store/enable`, {
    entityTypes: ['user', 'host'],
  });
  for (const entityType of ['user', 'host']) {
    await call('init_engine', 'POST', `${prefix}/api/entity_store/engines/${entityType}/init`, {});
    await call('start_engine', 'POST', `${prefix}/api/entity_store/engines/${entityType}/start`, {});
  }
  await call('start_store', 'PUT', `${prefix}/api/security/entity_store/start`, {
    entityTypes: ['user', 'host'],
  });

  const entities = FRAUD_CASES.flatMap((c) => [
    {
      type: 'user',
      id: c.user,
      attributes: {
        '@timestamp': new Date().toISOString(),
        user: { name: c.user },
        entity: { name: c.user, type: 'user' },
      },
    },
    {
      type: 'host',
      id: c.host,
      attributes: {
        '@timestamp': new Date().toISOString(),
        host: { name: c.host },
        entity: { name: c.host, type: 'host' },
      },
    },
  ]);
  await call('upsert_entities', 'PUT', `${prefix}/api/entity_store/entities/bulk?force=true`, {
    entities,
  });

  return { skipped: false, steps };
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

  const { url, apiKey, kibana, source, o11yFallbackSet, spaces } = creds();
  const configured = Boolean(url && apiKey);

  if (req.method === 'GET') {
    json(res, 200, {
      configured,
      source,
      host: configured ? url.replace(/^https?:\/\//, '') : null,
      kibana: kibana || null,
      spaceIds: spaces,
      hint: configured
        ? looksLikeObservability(url)
          ? 'SECURITY_ES_URL looks like the Observability project — point it at my-security-project-ac9463 ES.'
          : 'Open Entity analytics in the Default space after seeding (custom spaces stay empty).'
        : 'Set SECURITY_ES_URL + SECURITY_ES_API_KEY on Vercel for the Security Serverless project, then redeploy. Do not use ES_URL (O11Y).',
      o11yFallbackWouldHaveBeenUsed: !configured && o11yFallbackSet,
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
        'SECURITY_ES_URL and SECURITY_ES_API_KEY are not set on Vercel. Add them for my-security-project-ac9463 (not the Observability ES_URL), then redeploy.',
      hint: 'Vercel → Project → Settings → Environment Variables → Production',
    });
    return;
  }

  if (looksLikeObservability(url)) {
    json(res, 503, {
      error:
        'SECURITY_ES_URL points at the Observability project. Fraud alerts must go to the Security project ES endpoint (my-security-project-ac9463.es…).',
    });
    return;
  }

  try {
    const alerts = gamingFraudAlerts(spaces);
    const alertResult = await bulkIndex(url, apiKey, '.alerts-security.alerts-default', alerts);
    if (!alertResult.indexed) {
      json(res, 502, {
        error: alertResult.firstError[0]?.reason || 'Failed to index alerts',
        indexed: 0,
        errors: alertResult.errors,
        firstError: alertResult.firstError,
      });
      return;
    }

    // Best-effort: seed entity risk docs (Entity analytics reads risk-score.*).
    const riskDocs = gamingRiskDocs();
    const riskResults = [];
    for (const space of spaces) {
      const index = `risk-score.risk-score-${space}`;
      const rr = await bulkIndex(url, apiKey, index, riskDocs);
      riskResults.push({ space, index, indexed: rr.indexed, errors: rr.errors, firstError: rr.firstError });
    }

    // Best-effort: init/enable/run risk engine in each space.
    const engine = [];
    for (const space of spaces) {
      engine.push({ space, ...(await kickRiskEngine(kibana, apiKey, space)) });
    }

    const riskIndexed = riskResults.reduce((n, r) => n + r.indexed, 0);

    json(res, 200, {
      ok: true,
      indexed: alertResult.indexed,
      riskIndexed,
      riskResults,
      engine,
      spaceIds: spaces,
      message: `Seeded ${alertResult.indexed} alerts and ${riskIndexed} entity risk scores (spaces: ${spaces.join(', ')}).`,
      open:
        'Use Default space → Entity analytics (not “Security - psimkins”). Deep link: /s/default/app/security/entity_analytics. Alerts: /s/default/app/security/alerts.',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
