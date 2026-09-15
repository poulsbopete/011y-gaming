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

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
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
  const upstream = await fetch(`${kibana}${path}`, {
    method,
    headers: kbnHeaders(apiKey),
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
    json(res, 200, { configured, workflowId: WORKFLOW_ID, workflowHref });
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

    const executionId =
      run.body?.executionId ||
      run.body?.id ||
      run.body?.execution_id ||
      (typeof run.body?.data === 'object' ? run.body.data.executionId || run.body.data.id : null);

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
