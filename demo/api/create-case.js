/**
 * Create Blizzard fraud cases that reflect O11Y ↔ Security CPS.
 *
 * - Always opens an **Observability** case (origin project) with CPS correlation
 *   context, deep links, and a sample CPS ES|QL against the linked Security project.
 * - Also opens a **Security** case when SECURITY_ES_URL + SECURITY_ES_API_KEY are set.
 *
 * POST /api/create-case
 *   { title, description, severity, entity, region, signal, alertId }
 * GET  /api/create-case
 *   { configured, o11yConfigured, securityConfigured, casesHref, o11yCasesHref, cpsAlias }
 */
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function spaceId() {
  const raw = (process.env.SECURITY_SPACE_IDS || 'default').trim().split(',')[0]?.trim();
  return raw || 'default';
}

function kibanaFromEs(esUrl, explicit) {
  const e = (explicit || '').trim().replace(/\/$/, '');
  if (e) return e;
  if (!esUrl) return '';
  return esUrl.replace('.es.', '.kb.');
}

function o11yCreds() {
  const url = (process.env.ES_URL || '').trim().replace(/\/$/, '');
  const apiKey = (process.env.ES_API_KEY || '').trim();
  const kibana = kibanaFromEs(url, process.env.KIBANA_URL);
  return { url, apiKey, kibana };
}

function securityCreds() {
  const url = (process.env.SECURITY_ES_URL || '').trim().replace(/\/$/, '');
  const apiKey = (process.env.SECURITY_ES_API_KEY || '').trim();
  const kibana = kibanaFromEs(url, process.env.SECURITY_KIBANA_URL);
  const space = spaceId();
  return { url, apiKey, kibana, space };
}

function cpsAlias() {
  return (process.env.SECURITY_CPS_ALIAS || 'my-security-project-ac9463').trim();
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function caseHref(kibana, space, caseId, app = 'security') {
  if (!kibana || !caseId) return null;
  if (app === 'observability') {
    return `${kibana}/app/observability/cases/${encodeURIComponent(caseId)}`;
  }
  const prefix = space ? `/s/${encodeURIComponent(space)}` : '';
  return `${kibana}${prefix}/app/security/cases/${encodeURIComponent(caseId)}`;
}

function buildCpsDescription(body, title) {
  const alias = cpsAlias();
  const o11y = o11yCreds();
  const sec = securityCreds();
  const o11yBase = (o11y.kibana || '').replace(/\/$/, '');
  const secBase = (sec.kibana || '').replace(/\/$/, '');
  const space = sec.space || 'default';

  const authApm = o11yBase
    ? `${o11yBase}/app/apm/services/auth/overview?comparisonEnabled=true&environment=ENVIRONMENT_ALL&rangeFrom=now-24h&rangeTo=now`
    : 'Observability → APM → auth';
  const launchOps = o11yBase
    ? `${o11yBase}/app/dashboards#/view/aether-launch-ops?_g=(time:(from:now-24h,to:now))`
    : 'Observability → Dashboards → Blizzard — Launch ops';
  const secAlerts = secBase
    ? `${secBase}/s/${encodeURIComponent(space)}/app/security/alerts`
    : 'Security → Alerts (Default space)';

  const cpsEsql = [
    `FROM ${alias}:.alerts-security.alerts-default`,
    '| WHERE kibana.alert.rule.name LIKE "*Credential*" OR kibana.alert.rule.name LIKE "*Blizzard*" OR labels.studio == "Blizzard"',
    '| SORT @timestamp DESC',
    '| KEEP @timestamp, kibana.alert.rule.name, kibana.alert.severity, kibana.alert.reason',
    '| LIMIT 20',
  ].join('\n');

  return [
    body.description || title,
    '',
    '## Cross-project search (CPS)',
    `Origin: **Observability Serverless** · Linked Security alias: \`${alias}\``,
    'Elastic↔Elastic correlation uses **CPS** (not A2A). A2A is for non-Elastic agents.',
    '',
    '### O11Y evidence',
    body.signal ? `- Signal: ${body.signal}` : '- Signal: launch-window auth / session anomaly',
    body.entity ? `- Entity: \`${body.entity}\`` : '',
    body.region ? `- Region: ${body.region}` : '',
    body.alertId ? `- Demo alert id: \`${body.alertId}\`` : '',
    `- APM auth: ${authApm}`,
    `- Launch ops board: ${launchOps}`,
    '',
    '### Security via CPS',
    `- Security alerts: ${secAlerts}`,
    '- Run this ES|QL from the **Observability** origin (Discover / ES|QL) after CPS link is enabled:',
    '```esql',
    cpsEsql,
    '```',
    '',
    'Opened from the Blizzard × Elastic Serverless POC.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

async function postCase(kibana, apiKey, space, payload) {
  const prefix = space ? `/s/${encodeURIComponent(space)}` : '';
  const upstream = await fetch(`${kibana}${prefix}/api/cases`, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'kbn-xsrf': 'true',
      'x-elastic-internal-origin': 'kibana',
      'Content-Type': 'application/json',
      'Elastic-Api-Version': '2023-10-31',
    },
    body: JSON.stringify(payload),
  });
  const text = await upstream.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 800) };
  }
  return { ok: upstream.ok, status: upstream.status, parsed };
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

  const o11y = o11yCreds();
  const security = securityCreds();
  const alias = cpsAlias();
  const o11yConfigured = Boolean(o11y.kibana && o11y.apiKey);
  const securityConfigured = Boolean(security.kibana && security.apiKey);
  const configured = o11yConfigured || securityConfigured;

  const o11yCasesHref = o11yConfigured ? `${o11y.kibana}/app/observability/cases` : null;
  const casesHref = securityConfigured
    ? `${security.kibana}/s/${encodeURIComponent(security.space)}/app/security/cases`
    : o11yCasesHref;

  if (req.method === 'GET') {
    json(res, 200, {
      configured,
      o11yConfigured,
      securityConfigured,
      casesHref,
      o11yCasesHref,
      cpsAlias: alias,
      space: security.space,
    });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to create a case' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error:
        'Set ES_URL + ES_API_KEY (Observability) and/or SECURITY_ES_URL + SECURITY_ES_API_KEY (Security) so cases can reflect CPS.',
    });
    return;
  }

  const body = await readJson(req);
  const title = String(body.title || 'Blizzard fraud — CPS correlation').slice(0, 160);
  const severity = ['low', 'medium', 'high', 'critical'].includes(String(body.severity || '').toLowerCase())
    ? String(body.severity).toLowerCase()
    : 'high';
  const description = buildCpsDescription(body, title);

  const sharedTags = ['blizzard', 'cps', 'fraud', 'demo', 'o11y-security'];
  const results = { o11y: null, security: null };

  try {
    if (o11yConfigured) {
      const payload = {
        title: `[CPS] ${title}`,
        description,
        tags: [...sharedTags, 'observability'],
        severity,
        assignees: [],
        owner: 'observability',
        connector: { id: 'none', name: 'none', type: '.none', fields: null },
        settings: { syncAlerts: false },
      };
      const r = await postCase(o11y.kibana, o11y.apiKey, null, payload);
      if (!r.ok) {
        results.o11y = {
          ok: false,
          error: r.parsed?.message || r.parsed?.error || `O11Y Cases HTTP ${r.status}`,
          kibanaStatus: r.status,
        };
      } else {
        const id = r.parsed?.id || null;
        results.o11y = {
          ok: true,
          id,
          title: r.parsed?.title || payload.title,
          status: r.parsed?.status || 'open',
          href: caseHref(o11y.kibana, null, id, 'observability'),
          owner: 'observability',
        };
      }
    }

    if (securityConfigured) {
      const payload = {
        title,
        description,
        tags: [...sharedTags, 'securitySolution'],
        severity,
        assignees: [],
        owner: 'securitySolution',
        connector: { id: 'none', name: 'none', type: '.none', fields: null },
        settings: { syncAlerts: false },
      };
      const r = await postCase(security.kibana, security.apiKey, security.space, payload);
      if (!r.ok) {
        results.security = {
          ok: false,
          error: r.parsed?.message || r.parsed?.error || `Security Cases HTTP ${r.status}`,
          kibanaStatus: r.status,
        };
      } else {
        const id = r.parsed?.id || null;
        results.security = {
          ok: true,
          id,
          title: r.parsed?.title || title,
          status: r.parsed?.status || 'open',
          href: caseHref(security.kibana, security.space, id, 'security'),
          owner: 'securitySolution',
        };
      }
    }

    const primary = results.o11y?.ok ? results.o11y : results.security?.ok ? results.security : null;
    if (!primary) {
      json(res, 502, {
        error:
          results.o11y?.error ||
          results.security?.error ||
          'Case create failed on both Observability and Security',
        results,
        casesHref,
        o11yCasesHref,
        cpsAlias: alias,
      });
      return;
    }

    json(res, 200, {
      ok: true,
      id: primary.id,
      title: primary.title,
      status: primary.status,
      href: primary.href,
      owner: primary.owner,
      casesHref,
      o11yCasesHref,
      cpsAlias: alias,
      results,
      message: results.o11y?.ok && results.security?.ok
        ? 'Opened Observability + Security cases with CPS correlation context.'
        : results.o11y?.ok
          ? 'Opened Observability case with CPS → Security correlation context.'
          : 'Opened Security case with O11Y/CPS context.',
    });
  } catch (err) {
    json(res, 500, {
      error: err instanceof Error ? err.message : String(err),
      casesHref,
      o11yCasesHref,
      cpsAlias: alias,
    });
  }
}
