/**
 * Seed Aether Games demo metrics into Elastic Observability Serverless via mOTLP.
 * Uses server-only ES_URL + ES_API_KEY (never VITE_*).
 *
 * POST /api/seed-metrics
 * GET  /api/seed-metrics → { configured: boolean }
 */
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function ingestBaseFromEs(esUrl) {
  const base = String(esUrl || '').replace(/\/$/, '');
  if (!base) return '';
  if (base.includes('.ingest.')) return base;
  if (base.includes('.es.')) return base.replace('.es.', '.ingest.');
  return base;
}

function nowNano() {
  return `${BigInt(Date.now()) * 1000000n}`;
}

function buildOtlpPayload() {
  const t = nowNano();
  const services = ['matchmaking', 'auth', 'session-gateway', 'store'];
  const metrics = [];

  for (const svc of services) {
    metrics.push({
      name: 'http_requests_total',
      sum: {
        aggregationTemporality: 2,
        isMonotonic: true,
        dataPoints: [
          {
            asDouble: 50 + Math.floor(Math.random() * 40),
            timeUnixNano: t,
            attributes: [
              { key: 'service', value: { stringValue: svc } },
              { key: 'http.method', value: { stringValue: 'POST' } },
              { key: 'status', value: { stringValue: '200' } },
            ],
          },
        ],
      },
    });
  }

  metrics.push({
    name: 'aether_matchmaking_queue_depth',
    gauge: {
      dataPoints: [
        {
          asDouble: 80 + Math.floor(Math.random() * 200),
          timeUnixNano: t,
          attributes: [
            { key: 'service', value: { stringValue: 'matchmaking' } },
            { key: 'region', value: { stringValue: 'us-west' } },
          ],
        },
      ],
    },
  });

  metrics.push({
    name: 'aether_auth_logins_total',
    sum: {
      aggregationTemporality: 2,
      isMonotonic: true,
      dataPoints: [
        {
          asDouble: 40 + Math.floor(Math.random() * 80),
          timeUnixNano: t,
          attributes: [
            { key: 'service', value: { stringValue: 'auth' } },
            { key: 'result', value: { stringValue: 'success' } },
          ],
        },
      ],
    },
  });

  metrics.push({
    name: 'aether_concurrent_players',
    gauge: {
      dataPoints: [
        {
          asDouble: 180000 + Math.floor(Math.random() * 20000),
          timeUnixNano: t,
          attributes: [{ key: 'region', value: { stringValue: 'us-west' } }],
        },
      ],
    },
  });

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'aether-games-fleet' } },
            { key: 'deployment.environment', value: { stringValue: 'vercel-demo' } },
            { key: 'aether.studio', value: { stringValue: 'Aether Games' } },
          ],
        },
        scopeMetrics: [
          {
            scope: { name: 'aether.games.vercel', version: '1.0.0' },
            metrics,
          },
        ],
      },
    ],
  };
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

  const esUrl = (process.env.ES_URL || '').trim();
  const apiKey = (process.env.ES_API_KEY || '').trim();
  const configured = Boolean(esUrl && apiKey);

  if (req.method === 'GET') {
    json(res, 200, {
      configured,
      ingest: configured ? ingestBaseFromEs(esUrl).replace(/https?:\/\//, '') : null,
    });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to seed metrics' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error: 'ES_URL and ES_API_KEY are not set on this deployment (server-only Vercel env).',
    });
    return;
  }

  const ingest = ingestBaseFromEs(esUrl);
  const endpoint = `${ingest}/v1/metrics`;
  const payload = buildOtlpPayload();

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      json(res, 502, {
        error: 'OTLP ingest failed',
        status: upstream.status,
        body: text.slice(0, 800),
        endpoint: endpoint.replace(/https?:\/\//, ''),
      });
      return;
    }
    json(res, 200, {
      ok: true,
      message: 'Seeded Aether Games OTLP metrics (matchmaking, auth, players, http).',
      endpoint: endpoint.replace(/https?:\/\//, ''),
      hint: 'Wait ~30–60s, then Discover: FROM metrics-* | WHERE service.name == "aether-games-fleet"',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
