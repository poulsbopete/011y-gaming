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

const HTTP_ROUTES = {
  matchmaking: [
    ['POST', '/v1/matchmaking/tickets'],
    ['GET', '/v1/matchmaking/queue'],
    ['POST', '/v1/matchmaking/ready'],
    ['DELETE', '/v1/matchmaking/tickets'],
  ],
  auth: [
    ['POST', '/v1/auth/login'],
    ['POST', '/v1/auth/refresh'],
    ['GET', '/v1/auth/session'],
  ],
  'session-gateway': [
    ['POST', '/v1/sessions'],
    ['GET', '/v1/sessions/active'],
    ['POST', '/v1/sessions/heartbeat'],
  ],
  store: [
    ['POST', '/v1/store/checkout'],
    ['GET', '/v1/store/catalog'],
    ['POST', '/v1/store/entitlements'],
  ],
};

const SPANS_PER_SERVICE = {
  matchmaking: 450,
  auth: 280,
  'session-gateway': 280,
  store: 220,
};

const WAVES = 3;

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

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
              asDouble: 400 + Math.floor(Math.random() * 600),
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
              count: `${randInt(80, 180)}`,
              sum: 2400 + Math.random() * 800,
              bucketCounts: ['20', '40', '30', '20', '10'],
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
              asDouble: 200 + Math.floor(Math.random() * 180),
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

function spanTimes(nowMs) {
  const windowMs = Math.random() < 0.72 ? 2 * 3600_000 : 24 * 3600_000;
  const endMs = nowMs - randInt(0, windowMs);
  return endMs;
}

function durationMs(svc) {
  if (svc === 'matchmaking') {
    return Math.random() < 0.14 ? randInt(80, 420) : randInt(3, 28);
  }
  if (svc === 'session-gateway') return randInt(4, 45);
  if (svc === 'auth') return randInt(2, 35);
  return randInt(8, 60);
}

function buildTracesPayload() {
  const nowMs = Date.now();
  const resourceSpans = SERVICES.filter((s) => s !== 'aether-games-fleet').map((svc) => {
    const routes = HTTP_ROUTES[svc];
    const count = SPANS_PER_SERVICE[svc] || 200;
    const spans = [];

    for (let i = 0; i < count; i++) {
      const [method, route] = pick(routes);
      const failed = Math.random() < (svc === 'auth' ? 0.06 : 0.035);
      const status = failed ? 500 : 200;
      const endMs = spanTimes(nowMs);
      const dur = durationMs(svc);
      const startMs = endMs - dur;
      const traceId = hexId(16);
      const spanId = hexId(8);
      const startNano = `${BigInt(startMs) * 1000000n}`;
      const endNano = `${BigInt(endMs) * 1000000n}`;

      spans.push({
        traceId,
        spanId,
        name: `${method} ${route}`,
        kind: 2,
        startTimeUnixNano: startNano,
        endTimeUnixNano: endNano,
        attributes: [
          { key: 'http.method', value: { stringValue: method } },
          { key: 'http.request.method', value: { stringValue: method } },
          { key: 'http.route', value: { stringValue: route } },
          { key: 'url.path', value: { stringValue: route } },
          { key: 'http.status_code', value: { intValue: String(status) } },
          { key: 'http.response.status_code', value: { intValue: String(status) } },
        ],
        status: { code: failed ? 2 : 1 },
      });

      spans.push({
        traceId,
        spanId: hexId(8),
        parentSpanId: spanId,
        name: `${svc}.db`,
        kind: 3,
        startTimeUnixNano: `${BigInt(startMs) * 1000000n + 500000n}`,
        endTimeUnixNano: `${BigInt(endMs) * 1000000n - 200000n}`,
        attributes: [{ key: 'db.system', value: { stringValue: 'postgresql' } }],
        status: { code: 1 },
      });
    }

    return {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: svc } },
          { key: 'deployment.environment', value: { stringValue: 'vercel-demo' } },
          { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
        ],
      },
      scopeSpans: [{ scope: { name: 'aether.games.vercel', version: '1.0.0' }, spans }],
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
      tracesPerWave: SPANS_PER_SERVICE,
      waves: WAVES,
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
    let metricsOk = 0;
    let tracesOk = 0;
    let lastMetrics;
    let lastTraces;
    let spanTotal = 0;

    for (let wave = 0; wave < WAVES; wave++) {
      const metricsPayload = buildMetricsPayload();
      const tracesPayload = buildTracesPayload();
      spanTotal += tracesPayload.resourceSpans.reduce(
        (n, rs) => n + (rs.scopeSpans?.[0]?.spans?.length || 0),
        0,
      );
      lastMetrics = await postOtlp(`${ingest}/v1/metrics`, apiKey, metricsPayload);
      lastTraces = await postOtlp(`${ingest}/v1/traces`, apiKey, tracesPayload);
      if (lastMetrics.ok) metricsOk += 1;
      if (lastTraces.ok) tracesOk += 1;
    }

    if (metricsOk === 0 && tracesOk === 0) {
      json(res, 502, {
        error: 'OTLP ingest failed for metrics and traces',
        metrics: lastMetrics,
        traces: lastTraces,
        endpoint: ingest.replace(/https?:\/\//, ''),
      });
      return;
    }

    json(res, 200, {
      ok: true,
      message: `Seeded ${spanTotal} spans across ${WAVES} waves (matchmaking, auth, session-gateway, store).`,
      metrics: { okWaves: metricsOk, lastStatus: lastMetrics?.status },
      traces: {
        okWaves: tracesOk,
        lastStatus: lastTraces?.status,
        body: lastTraces?.ok ? undefined : lastTraces?.body,
      },
      services: SERVICES.filter((s) => s !== 'aether-games-fleet'),
      hint: 'Wait ~30–60s, then refresh APM Transactions (Last 24h). Most volume is in the last 2 hours.',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
