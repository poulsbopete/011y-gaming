/**
 * Seed Aether Games demo telemetry into Elastic Observability Serverless via mOTLP.
 * Sends metrics + traces so Discover, APM Services, and Metrics light up.
 * Uses server-only ES_URL + ES_API_KEY (never VITE_*).
 *
 * POST /api/seed-metrics
 * GET  /api/seed-metrics → { configured: boolean }
 */
import { randomBytes } from 'node:crypto';

const SERVICES = ['matchmaking', 'auth', 'session-gateway', 'store', 'aether-games-fleet'];

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

function hexId(bytes) {
  return randomBytes(bytes).toString('hex');
}

function buildMetricsPayload() {
  const t = nowNano();
  const resourceMetrics = SERVICES.map((svc) => {
    const metrics = [
      {
        name: 'http_requests_total',
        sum: {
          aggregationTemporality: 2,
          isMonotonic: true,
          dataPoints: [
            {
              asDouble: 40 + Math.floor(Math.random() * 60),
              timeUnixNano: t,
              attributes: [
                { key: 'http.method', value: { stringValue: 'POST' } },
                { key: 'http.status_code', value: { intValue: '200' } },
              ],
            },
          ],
        },
      },
      {
        name: 'http_server_duration',
        unit: 'ms',
        histogram: {
          aggregationTemporality: 2,
          dataPoints: [
            {
              startTimeUnixNano: t,
              timeUnixNano: t,
              count: '12',
              sum: 240 + Math.random() * 80,
              bucketCounts: ['2', '4', '3', '2', '1'],
              explicitBounds: [50, 100, 200, 500],
              attributes: [{ key: 'http.route', value: { stringValue: `/${svc}` } }],
            },
          ],
        },
      },
    ];

    if (svc === 'matchmaking' || svc === 'aether-games-fleet') {
      metrics.push({
        name: 'aether_matchmaking_queue_depth',
        gauge: {
          dataPoints: [
            {
              asDouble: 80 + Math.floor(Math.random() * 200),
              timeUnixNano: t,
              attributes: [{ key: 'region', value: { stringValue: 'us-west' } }],
            },
          ],
        },
      });
    }
    if (svc === 'auth' || svc === 'aether-games-fleet') {
      metrics.push({
        name: 'aether_auth_logins_total',
        sum: {
          aggregationTemporality: 2,
          isMonotonic: true,
          dataPoints: [
            {
              asDouble: 40 + Math.floor(Math.random() * 80),
              timeUnixNano: t,
              attributes: [{ key: 'result', value: { stringValue: 'success' } }],
            },
          ],
        },
      });
    }
    if (svc === 'aether-games-fleet') {
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
    }

    return {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: svc } },
          { key: 'deployment.environment', value: { stringValue: 'vercel-demo' } },
          { key: 'aether.studio', value: { stringValue: 'Aether Games' } },
        ],
      },
      scopeMetrics: [{ scope: { name: 'aether.games.vercel', version: '1.0.0' }, metrics }],
    };
  });

  return { resourceMetrics };
}

function buildTracesPayload() {
  const end = BigInt(Date.now()) * 1000000n;
  const resourceSpans = SERVICES.filter((s) => s !== 'aether-games-fleet').map((svc) => {
    const start = end - BigInt(5_000_000 + Math.floor(Math.random() * 40_000_000));
    const traceId = hexId(16);
    const spanId = hexId(8);
    return {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: svc } },
          { key: 'deployment.environment', value: { stringValue: 'vercel-demo' } },
          { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
        ],
      },
      scopeSpans: [
        {
          scope: { name: 'aether.games.vercel', version: '1.0.0' },
          spans: [
            {
              traceId,
              spanId,
              name: `${svc}.request`,
              kind: 2,
              startTimeUnixNano: `${start}`,
              endTimeUnixNano: `${end}`,
              attributes: [
                { key: 'http.method', value: { stringValue: 'POST' } },
                { key: 'http.route', value: { stringValue: `/${svc}` } },
                { key: 'http.status_code', value: { intValue: '200' } },
              ],
              status: { code: 1 },
            },
            {
              traceId,
              spanId: hexId(8),
              parentSpanId: spanId,
              name: `${svc}.db`,
              kind: 3,
              startTimeUnixNano: `${start + 1000000n}`,
              endTimeUnixNano: `${end - 500000n}`,
              attributes: [{ key: 'db.system', value: { stringValue: 'postgresql' } }],
              status: { code: 1 },
            },
          ],
        },
      ],
    };
  });

  return { resourceSpans };
}

async function postOtlp(endpoint, apiKey, payload) {
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await upstream.text();
  return { ok: upstream.ok, status: upstream.status, body: text.slice(0, 600) };
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
  const ingest = ingestBaseFromEs(esUrl);

  if (req.method === 'GET') {
    json(res, 200, {
      configured,
      ingest: configured ? ingest.replace(/https?:\/\//, '') : null,
      services: SERVICES,
    });
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to seed metrics + traces' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error: 'ES_URL and ES_API_KEY are not set on this deployment (server-only Vercel env).',
    });
    return;
  }

  try {
    const metrics = await postOtlp(`${ingest}/v1/metrics`, apiKey, buildMetricsPayload());
    const traces = await postOtlp(`${ingest}/v1/traces`, apiKey, buildTracesPayload());

    if (!metrics.ok && !traces.ok) {
      json(res, 502, {
        error: 'OTLP ingest failed for metrics and traces',
        metrics,
        traces,
        endpoint: ingest.replace(/https?:\/\//, ''),
      });
      return;
    }

    json(res, 200, {
      ok: true,
      message: 'Seeded Aether metrics + traces (matchmaking, auth, session-gateway, store).',
      metrics: { ok: metrics.ok, status: metrics.status },
      traces: { ok: traces.ok, status: traces.status, body: traces.ok ? undefined : traces.body },
      services: SERVICES.filter((s) => s !== 'aether-games-fleet'),
      hint: 'Wait ~30–60s, then open APM Services or Discover in the O11Y project.',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
