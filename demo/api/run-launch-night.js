/**
 * Ensure + run the Kibana workflow "Aether — Launch night incident".
 *
 * POST /api/run-launch-night  → upsert YAML, then POST .../run
 * GET  /api/run-launch-night  → { configured, workflowHref }
 *
 * Server-only: ES_API_KEY + ES_URL (or KIBANA_URL). Same key as seed-metrics.
 */
const WORKFLOW_ID = 'aether-launch-night';

const WORKFLOW_YAML = `version: "1"
name: Aether — Launch night incident
description: |
  POV for a launch-window incident. Pulls live metrics, traces, and logs
  for matchmaking / auth / session-gateway, then Agent Builder writes a triage brief.
enabled: true
tags:
  - aether-games
  - launch-night
  - DEMO
triggers:
  - type: manual
steps:
  - name: workflow-start
    type: console
    with:
      message: |
        Aether launch-night workflow started (execution {{ execution.id }}).
        Probing metrics-*, traces-*, logs-* for matchmaking / auth / session-gateway.
  - name: probe_metrics
    type: elasticsearch.request
    with:
      method: POST
      path: /_query
      body:
        query: |
          FROM metrics-*
          | WHERE service.name IN ("matchmaking", "auth", "session-gateway", "aether-games-fleet")
          | STATS metric_points = COUNT(*) BY service.name
          | SORT metric_points DESC
          | LIMIT 15
  - name: probe_traces
    type: elasticsearch.request
    with:
      method: POST
      path: /_query
      body:
        query: |
          FROM traces-*
          | WHERE service.name IN ("matchmaking", "auth", "session-gateway", "store")
          | STATS spans = COUNT(*) BY service.name
          | SORT spans DESC
          | LIMIT 15
  - name: probe_logs
    type: elasticsearch.request
    continue: true
    with:
      method: POST
      path: /_query
      body:
        query: |
          FROM logs-*
          | WHERE service.name IN ("matchmaking", "auth", "session-gateway")
             OR message LIKE "*matchmaking*"
             OR message LIKE "*login*"
          | STATS log_lines = COUNT(*) BY service.name
          | SORT log_lines DESC
          | LIMIT 15
  - name: agent_triage
    type: ai.agent
    with:
      message: |
        You are an SRE on Aether Games launch night. Use only the probe output.
        Metrics: {{ steps.probe_metrics.output }}
        Traces: {{ steps.probe_traces.output }}
        Logs: {{ steps.probe_logs.output }}
        Write markdown: verdict, metrics, traces, logs (say empty if empty), 5 Kibana next steps
        (Discover metrics-*, APM matchmaking, traces-*, Security CPS if auth spikes, Horizon sprawl if widgets blank).
  - name: index_brief
    type: elasticsearch.request
    with:
      method: POST
      path: /aether-launch-night-runs/_doc
      body:
        "@timestamp": "{{ now | date: '%Y-%m-%dT%H:%M:%SZ' }}"
        execution_id: "{{ execution.id }}"
        workflow_name: "{{ workflow.name }}"
        source: aether_launch_night
        brief: "{{ steps.agent_triage.output.message }}"
  - name: workflow-done
    type: console
    with:
      message: Launch-night triage indexed to aether-launch-night-runs.
`;

const UI_STEP_BY_KIBANA = {
  'workflow-start': 'metrics',
  probe_metrics: 'metrics',
  probe_traces: 'traces',
  probe_logs: 'logs',
  agent_triage: 'agent',
  index_brief: 'index',
  'workflow-done': 'index',
};

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'canceled', 'timed_out', 'timeout']);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function pickExecutionId(body) {
  if (!body || typeof body !== 'object') return null;
  return (
    body.executionId ||
    body.workflowExecutionId ||
    body.id ||
    body.execution_id ||
    body.data?.executionId ||
    body.data?.workflowExecutionId ||
    body.data?.id ||
    body.execution?.id ||
    null
  );
}

function normalizeStatus(raw) {
  const v = String(raw || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['completed', 'complete', 'success', 'succeeded', 'ok', 'done'].includes(v)) return 'completed';
  if (['failed', 'failure', 'error', 'timed_out', 'timeout', 'cancelled', 'canceled'].includes(v)) {
    return v.startsWith('cancel') ? 'failed' : v === 'error' ? 'failed' : v === 'failure' ? 'failed' : 'failed';
  }
  if (v === 'skipped') return 'skipped';
  if (['running', 'in_progress', 'pending', 'queued', 'waiting', 'waiting_for_input', 'not_started'].includes(v)) {
    return v === 'not_started' || v === 'pending' || v === 'queued' ? 'pending' : 'running';
  }
  return v || 'running';
}

function isTerminal(status) {
  return TERMINAL.has(String(status || '').toLowerCase()) || status === 'completed' || status === 'failed';
}

function firstArray(...candidates) {
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) return c;
  }
  return [];
}

function extractRawSteps(body) {
  if (!body || typeof body !== 'object') return [];
  const listed = firstArray(
    body.stepExecutions,
    body.step_executions,
    body.steps,
    body.data?.stepExecutions,
    body.data?.steps,
    body.execution?.stepExecutions,
    body.execution?.steps,
    body.workflowExecution?.stepExecutions,
    body.results,
  );
  if (listed.length) return listed;
  const map = body.stepExecutions || body.steps || body.data?.stepExecutions;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    return Object.entries(map).map(([name, value]) =>
      value && typeof value === 'object' ? { name, ...value } : { name, status: value },
    );
  }
  return [];
}

function mapUiSteps(rawSteps, overall) {
  const ui = {
    metrics: 'pending',
    traces: 'pending',
    logs: 'pending',
    agent: 'pending',
    index: 'pending',
  };
  for (const step of rawSteps) {
    if (!step || typeof step !== 'object') continue;
    const name = String(step.stepId || step.step_id || step.name || step.id || '');
    const key = UI_STEP_BY_KIBANA[name] || UI_STEP_BY_KIBANA[name.replace(/.*\./, '')];
    if (!key) continue;
    const status = normalizeStatus(step.status || step.state);
    const rank = { pending: 0, running: 1, skipped: 2, completed: 3, failed: 4 };
    if ((rank[status] ?? 0) >= (rank[ui[key]] ?? 0)) ui[key] = status;
  }
  if (overall === 'completed') {
    for (const k of Object.keys(ui)) {
      if (ui[k] === 'pending' || ui[k] === 'running') ui[k] = 'completed';
    }
  }
  if (overall === 'running') {
    const order = ['metrics', 'traces', 'logs', 'agent', 'index'];
    const hasLive = order.some((k) => ui[k] === 'running' || ui[k] === 'completed' || ui[k] === 'failed');
    if (!hasLive) ui.metrics = 'running';
  }
  return ui;
}

async function fetchExecution(kibana, apiKey, executionId) {
  const paths = [
    `/api/workflows/executions/${encodeURIComponent(executionId)}?includeOutput=true`,
    `/api/workflows/executions/${encodeURIComponent(executionId)}`,
    `/api/workflows/workflow/${WORKFLOW_ID}/executions/${encodeURIComponent(executionId)}`,
  ];
  let last = { ok: false, status: 0, body: null };
  for (const path of paths) {
    last = await kbn(kibana, apiKey, 'GET', path);
    if (last.ok) return last;
  }
  const list = await kbn(
    kibana,
    apiKey,
    'GET',
    `/api/workflows/workflow/${WORKFLOW_ID}/executions?perPage=20`,
  );
  if (list.ok) {
    const rows = firstArray(list.body?.results, list.body?.executions, list.body?.data, list.body?.items);
    const match = rows.find((row) => pickExecutionId(row) === executionId);
    if (match) return { ok: true, status: 200, body: match };
  }
  const steps = await kbn(
    kibana,
    apiKey,
    'GET',
    `/api/workflows/workflow/${WORKFLOW_ID}/executions/steps?executionId=${encodeURIComponent(executionId)}`,
  );
  if (steps.ok) return steps;
  return last;
}

async function briefIndexed(esUrl, apiKey, executionId) {
  if (!esUrl) return false;
  try {
    const upstream = await fetch(`${esUrl.replace(/\/$/, '')}/aether-launch-night-runs/_search`, {
      method: 'POST',
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: 1,
        query: {
          bool: {
            should: [
              { term: { execution_id: executionId } },
              { term: { 'execution_id.keyword': executionId } },
              { match_phrase: { execution_id: executionId } },
            ],
            minimum_should_match: 1,
          },
        },
      }),
    });
    const body = await upstream.json().catch(() => ({}));
    return Number(body?.hits?.total?.value ?? body?.hits?.total ?? 0) > 0 || Boolean(body?.hits?.hits?.length);
  } catch {
    return false;
  }
}

function kibanaFromEs(esUrl) {
  const base = String(esUrl || '').replace(/\/$/, '');
  if (!base) return '';
  if (base.includes('.kb.')) return base;
  if (base.includes('.es.')) return base.replace('.es.', '.kb.');
  if (base.includes('.ingest.')) return base.replace('.ingest.', '.kb.');
  return base;
}

function kbnHeaders(apiKey) {
  return {
    Authorization: `ApiKey ${apiKey}`,
    'kbn-xsrf': 'true',
    'x-elastic-internal-origin': 'kibana',
    'Content-Type': 'application/json',
    'Elastic-Api-Version': '2023-10-31',
  };
}

async function kbn(kibana, apiKey, method, path, body) {
  const headers = kbnHeaders(apiKey);
  if (body === undefined) delete headers['Content-Type'];
  const upstream = await fetch(`${kibana}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await upstream.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 800) };
  }
  return { ok: upstream.ok, status: upstream.status, body: parsed };
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
  const kibana = ((process.env.KIBANA_URL || '').trim() || kibanaFromEs(esUrl)).replace(/\/$/, '');
  const configured = Boolean(kibana && apiKey);
  const workflowHref = configured ? `${kibana}/app/workflows/${WORKFLOW_ID}` : null;

  if (req.method === 'GET') {
    const executionId = new URL(req.url, 'http://local').searchParams.get('executionId');
    if (!executionId) {
      json(res, 200, { configured, workflowId: WORKFLOW_ID, workflowHref });
      return;
    }
    if (!configured) {
      json(res, 503, { error: 'ES_URL/KIBANA_URL and ES_API_KEY are not set on this deployment.' });
      return;
    }
    try {
      const exec = await fetchExecution(kibana, apiKey, executionId);
      const raw = exec.body && typeof exec.body === 'object' ? exec.body : {};
      let status = normalizeStatus(
        raw.status || raw.state || raw.executionStatus || raw.execution?.status || raw.data?.status,
      );
      const rawSteps = extractRawSteps(raw);
      const indexed = await briefIndexed(esUrl, apiKey, executionId);
      if (indexed && !isTerminal(status)) status = 'completed';
      const steps = mapUiSteps(rawSteps, status);
      if (indexed) {
        steps.agent = steps.agent === 'pending' ? 'completed' : steps.agent;
        steps.index = 'completed';
      }
      json(res, exec.ok || indexed ? 200 : exec.status || 502, {
        ok: exec.ok || indexed,
        workflowId: WORKFLOW_ID,
        executionId,
        status,
        terminal: isTerminal(status),
        steps,
        indexed,
        workflowHref,
        executionHref: `${kibana}/app/workflows/${WORKFLOW_ID}`,
        kibanaStatus: exec.status,
        kibanaKeys: raw && typeof raw === 'object' ? Object.keys(raw) : [],
      });
    } catch (err) {
      json(res, 500, { error: err instanceof Error ? err.message : String(err), workflowHref });
    }
    return;
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST to run the launch-night workflow' });
    return;
  }

  if (!configured) {
    json(res, 503, {
      error: 'ES_URL/KIBANA_URL and ES_API_KEY are not set on this deployment.',
    });
    return;
  }

  try {
    const upsert = await kbn(kibana, apiKey, 'POST', '/api/workflows/workflow', {
      id: WORKFLOW_ID,
      yaml: WORKFLOW_YAML,
      enabled: true,
    });

    if (!upsert.ok) {
      const bulk = await kbn(kibana, apiKey, 'POST', '/api/workflows?overwrite=true', {
        workflows: [{ id: WORKFLOW_ID, yaml: WORKFLOW_YAML, enabled: true }],
      });
      if (!bulk.ok) {
        json(res, 502, {
          error: 'Could not create or update the Kibana workflow',
          upsert,
          bulk,
          workflowHref,
        });
        return;
      }
    }

    const run = await kbn(kibana, apiKey, 'POST', `/api/workflows/workflow/${WORKFLOW_ID}/run`, {
      inputs: {},
    });

    const executionId = pickExecutionId(run.body);

    if (!run.ok) {
      json(res, 502, {
        error: 'Workflow saved but run failed — open Kibana and click Run',
        run,
        workflowHref,
      });
      return;
    }

    json(res, 200, {
      ok: true,
      workflowId: WORKFLOW_ID,
      executionId,
      runStatus: run.status,
      runKeys: run.body && typeof run.body === 'object' ? Object.keys(run.body) : [],
      workflowHref,
      executionHref: executionId
        ? `${kibana}/app/workflows/${WORKFLOW_ID}`
        : workflowHref,
      hint: 'Watch the execution in Kibana — ES|QL probes then Agent Builder. This is not the 6s simulated ticker.',
    });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : String(err), workflowHref });
  }
}
