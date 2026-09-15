/**
 * Create a real Elastic Security case for the selected Aether fraud alert.
 *
 * POST /api/create-case  { title, description, severity, entity, region, signal, alertId }
 * GET  /api/create-case  { configured, casesHref }
 *
 * Server-only: SECURITY_ES_URL + SECURITY_ES_API_KEY (same as seed-fraud).
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
  const space = spaceId();
  return { url, apiKey, kibana, space };
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

function caseHref(kibana, space, caseId) {
  const prefix = `/s/${encodeURIComponent(space)}`;
  return `${kibana}${prefix}/app/security/cases/${encodeURIComponent(caseId)}`;
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

  const { apiKey, kibana, space } = creds();
  const configured = Boolean(kibana && apiKey);
  const casesHref = configured
    ? `${kibana}/s/${encodeURIComponent(space)}/app/security/cases`
    : null;

  if (req.method === 'GET') {
    json(res, 200, { configured, casesHref, space });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to create a Security case' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error:
        'SECURITY_ES_URL and SECURITY_ES_API_KEY are not set. Cases must be created on the Security project, not Observability.',
    });
    return;
  }

  const body = await readJson(req);
  const title = String(body.title || 'Aether Games fraud').slice(0, 160);
  const severity = ['low', 'medium', 'high', 'critical'].includes(String(body.severity || '').toLowerCase())
    ? String(body.severity).toLowerCase()
    : 'high';
  const description = [
    body.description || title,
    body.entity ? `Entity: ${body.entity}` : '',
    body.region ? `Region: ${body.region}` : '',
    body.signal ? `O11Y signal: ${body.signal}` : '',
    body.alertId ? `Demo alert: ${body.alertId}` : '',
    'Opened from the Aether Games POV (Vercel).',
  ]
    .filter(Boolean)
    .join('\n');

  const prefix = `/s/${encodeURIComponent(space)}`;
  const payload = {
    title,
    description,
    tags: ['aether-games', 'fraud', 'demo'],
    severity,
    assignees: [],
    owner: 'securitySolution',
    connector: { id: 'none', name: 'none', type: '.none', fields: null },
    settings: { syncAlerts: false },
  };

  try {
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

    if (!upstream.ok) {
      json(res, 502, {
        error: parsed?.message || parsed?.error || `Kibana Cases API HTTP ${upstream.status}`,
        kibanaStatus: upstream.status,
        kibana: parsed,
        casesHref,
      });
      return;
    }

    const id = parsed?.id || parsed?.caseId || parsed?.case_id || null;
    json(res, 200, {
      ok: true,
      id,
      title: parsed?.title || title,
      status: parsed?.status || 'open',
      href: id ? caseHref(kibana, space, id) : casesHref,
      casesHref,
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err), casesHref });
  }
}
