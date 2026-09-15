/**
 * Seed Aether Games demo telemetry into Elastic Observability Serverless via mOTLP.
 * Sends metrics + traces + logs so Discover, APM Transactions, Metrics, and Logs light up.
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

const LOGS_PER_SERVICE = {
  matchmaking: 90,
  auth: 70,
  'session-gateway': 70,
  store: 50,
};

const LOG_LINES = {
  matchmaking: [
    ['INFO', 9, 'matchmaking ticket created region=us-west queue_depth='],
    ['INFO', 9, 'matchmaking ready-check passed for party'],
    ['WARN', 13, 'matchmaking wait_seconds elevated in us-west'],
    ['ERROR', 17, 'matchmaking ticket allocate failed: no healthy session-gateway'],
  ],
  auth: [
    ['INFO', 9, 'login succeeded for battlenet-linked account'],
    ['WARN', 13, 'login rate-limit approaching for source.ip'],
    ['ERROR', 17, 'login failed invalid_refresh_token'],
    ['INFO', 9, 'session issued after login'],
  ],
  'session-gateway': [
    ['INFO', 9, 'session heartbeat ok'],
    ['WARN', 13, 'session-gateway websocket resume lag'],
    ['ERROR', 17, 'session bind failed: matchmaking correlation id missing'],
  ],
  store: [
    ['INFO', 9, 'store catalog cache hit'],
    ['INFO', 9, 'checkout started'],
    ['ERROR', 17, 'store checkout declined: payment_processor_timeout'],
  ],
};

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

function msToNano(ms) {
  return `${BigInt(Math.floor(ms)) * 1000000n}`;
}

function kv(key, stringValue) {
  return { key, value: { stringValue } };
}

function serviceResource(svc, instance) {
  return {
    attributes: [
      kv('service.name', svc),
      kv('service.instance.id', instance),
      kv('deployment.environment', 'vercel-demo'),
      kv('host.name', instance),
      kv('telemetry.sdk.name', 'opentelemetry'),
      kv('telemetry.sdk.language', 'nodejs'),
      kv('telemetry.sdk.version', '1.27.0'),
      kv('aether.studio', 'Aether Games'),
    ],
  };
}

/** APM Metrics charts host/process series, not custom Prom names. Spread points so Last 15m and Last 24h both hit. */
function gaugeSeries(nowMs, hours, valueFn) {
  const points = [];
  const steps = 36;
  const stepMs = (hours * 3600_000) / steps;
  for (let i = steps; i >= 0; i--) {
    points.push({
      asDouble: valueFn(i / steps),
      timeUnixNano: msToNano(nowMs - i * stepMs),
    });
  }
  return points;
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
  const nowMs = Date.now();
  const t = nowNano();
  const resourceMetrics = SERVICES.map((svc) => {
    const instance = `${svc}-usw-1`;
    const cpu = gaugeSeries(nowMs, 2, (p) => 0.12 + Math.sin(p * Math.PI * 4) * 0.08 + Math.random() * 0.04);
    const rss = gaugeSeries(nowMs, 2, (p) => 180_000_000 + p * 12_000_000 + Math.random() * 8_000_000);
    const heapUsed = gaugeSeries(nowMs, 2, (p) => 95_000_000 + p * 8_000_000 + Math.random() * 4_000_000);
    const heapTotal = gaugeSeries(nowMs, 2, () => 160_000_000 + Math.random() * 6_000_000);
    const eventLoop = gaugeSeries(nowMs, 2, () => 1.2 + Math.random() * 4.5);

    const metrics = [
      { name: 'system.cpu.utilization', unit: '1', gauge: { dataPoints: cpu } },
      { name: 'process.cpu.utilization', unit: '1', gauge: { dataPoints: cpu } },
      { name: 'process.memory.usage', unit: 'By', gauge: { dataPoints: rss } },
      {
        name: 'system.memory.utilization',
        unit: '1',
        gauge: { dataPoints: gaugeSeries(nowMs, 2, () => 0.42 + Math.random() * 0.08) },
      },
      { name: 'process.runtime.nodejs.memory.heap.used', unit: 'By', gauge: { dataPoints: heapUsed } },
      { name: 'process.runtime.nodejs.memory.heap.total', unit: 'By', gauge: { dataPoints: heapTotal } },
      { name: 'process.runtime.nodejs.event_loop.delay.max', unit: 'ms', gauge: { dataPoints: eventLoop } },
      { name: 'nodejs.memory.heap.used.bytes', unit: 'By', gauge: { dataPoints: heapUsed } },
      { name: 'nodejs.eventloop.delay.avg.ms', unit: 'ms', gauge: { dataPoints: eventLoop } },
      {
        name: 'http.server.request.duration',
        unit: 's',
        histogram: {
          aggregationTemporality: 1,
          dataPoints: [
            {
              startTimeUnixNano: msToNano(nowMs - 60_000),
              timeUnixNano: t,
              count: `${randInt(80, 180)}`,
              sum: 2.4 + Math.random() * 0.8,
              bucketCounts: ['20', '40', '30', '20', '10'],
              explicitBounds: [0.05, 0.1, 0.2, 0.5],
              attributes: [
                kv('http.request.method', 'POST'),
                kv('http.route', `/${svc}`),
                { key: 'http.response.status_code', value: { intValue: '200' } },
              ],
            },
          ],
        },
      },
      {
        name: 'http_requests_total',
        sum: {
          aggregationTemporality: 1,
          isMonotonic: true,
          dataPoints: [
            {
              asDouble: 400 + Math.floor(Math.random() * 600),
              timeUnixNano: t,
              attributes: [
                kv('http.method', 'POST'),
                { key: 'http.status_code', value: { intValue: '200' } },
              ],
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
              attributes: [kv('region', 'us-west')],
            },
          ],
        },
      });
    }
    if (svc === 'auth' || svc === 'aether-games-fleet') {
      metrics.push({
        name: 'aether_auth_logins_total',
        sum: {
          aggregationTemporality: 1,
          isMonotonic: true,
          dataPoints: [
            {
              asDouble: 200 + Math.floor(Math.random() * 180),
              timeUnixNano: t,
              attributes: [kv('result', 'success')],
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
              attributes: [kv('region', 'us-west')],
            },
          ],
        },
      });
    }

    return {
      resource: serviceResource(svc, instance),
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
      resource: serviceResource(svc, `${svc}-usw-1`),
      scopeSpans: [{ scope: { name: 'aether.games.vercel', version: '1.0.0' }, spans }],
    };
  });

  return { resourceSpans };
}

function logTime(nowMs) {
  if (Math.random() < 0.6) return nowMs - randInt(0, 12 * 60_000);
  if (Math.random() < 0.85) return nowMs - randInt(0, 2 * 3600_000);
  return nowMs - randInt(0, 24 * 3600_000);
}

function buildLogsPayload() {
  const nowMs = Date.now();
  const resourceLogs = SERVICES.filter((s) => s !== 'aether-games-fleet').map((svc) => {
    const templates = LOG_LINES[svc] || LOG_LINES.matchmaking;
    const count = LOGS_PER_SERVICE[svc] || 40;
    const logRecords = [];

    for (let i = 0; i < count; i++) {
      const [severityText, severityNumber, prefix] = pick(templates);
      const failed = severityNumber >= 17;
      const ts = logTime(nowMs);
      const suffix = failed ? ` err=${randInt(1, 9)}` : ` n=${randInt(10, 99)}`;
      logRecords.push({
        timeUnixNano: msToNano(ts),
        observedTimeUnixNano: msToNano(nowMs),
        severityNumber,
        severityText,
        body: { stringValue: `${prefix}${suffix}` },
        attributes: [
          kv('log.logger', `aether.${svc}`),
          kv('event.dataset', `${svc}.log`),
        ],
        traceId: hexId(16),
        spanId: hexId(8),
      });
    }

    return {
      resource: serviceResource(svc, `${svc}-usw-1`),
      scopeLogs: [{ scope: { name: 'aether.games.vercel', version: '1.0.0' }, logRecords }],
    };
  });

  return { resourceLogs };
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
    json(res, 405, { error: 'Use POST to seed metrics, traces, and logs' });
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
    let logsOk = 0;
    let lastMetrics;
    let lastTraces;
    let lastLogs;
    let spanTotal = 0;
    let logTotal = 0;

    for (let wave = 0; wave < WAVES; wave++) {
      const metricsPayload = buildMetricsPayload();
      const tracesPayload = buildTracesPayload();
      const logsPayload = buildLogsPayload();
      spanTotal += tracesPayload.resourceSpans.reduce(
        (n, rs) => n + (rs.scopeSpans?.[0]?.spans?.length || 0),
        0,
      );
      logTotal += logsPayload.resourceLogs.reduce(
        (n, rl) => n + (rl.scopeLogs?.[0]?.logRecords?.length || 0),
        0,
      );
      lastMetrics = await postOtlp(`${ingest}/v1/metrics`, apiKey, metricsPayload);
      lastTraces = await postOtlp(`${ingest}/v1/traces`, apiKey, tracesPayload);
      lastLogs = await postOtlp(`${ingest}/v1/logs`, apiKey, logsPayload);
      if (lastMetrics.ok) metricsOk += 1;
      if (lastTraces.ok) tracesOk += 1;
      if (lastLogs.ok) logsOk += 1;
    }

    if (metricsOk === 0 && tracesOk === 0 && logsOk === 0) {
      json(res, 502, {
        error: 'OTLP ingest failed for metrics, traces, and logs',
        metrics: lastMetrics,
        traces: lastTraces,
        logs: lastLogs,
        endpoint: ingest.replace(/https?:\/\//, ''),
      });
      return;
    }

    json(res, 200, {
      ok: true,
      message: `Seeded ${spanTotal} spans and ${logTotal} log lines across ${WAVES} waves (matchmaking, auth, session-gateway, store).`,
      metrics: { okWaves: metricsOk, lastStatus: lastMetrics?.status },
      traces: {
        okWaves: tracesOk,
        lastStatus: lastTraces?.status,
        body: lastTraces?.ok ? undefined : lastTraces?.body,
      },
      logs: {
        okWaves: logsOk,
        lastStatus: lastLogs?.status,
        body: lastLogs?.ok ? undefined : lastLogs?.body,
      },
      services: SERVICES.filter((s) => s !== 'aether-games-fleet'),
      hint: 'Wait ~30–60s, then APM → matchmaking → Transactions, Metrics, and Logs (Last 24h, or Last 15m right after seed).',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
