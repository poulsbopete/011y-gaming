#!/usr/bin/env node
/**
 * Upsert Vega visualizations + dashboard "Aether — Launch ops" (id: aether-launch-ops).
 *
 * Loads ES_URL / ES_API_KEY from demo/.env.local (or the environment).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DASH_ID = 'aether-launch-ops';
const SVC =
  'service.name IN ("matchmaking", "auth", "session-gateway", "store", "aether-games-fleet")';
const DOMAIN = [
  'matchmaking',
  'auth',
  'session-gateway',
  'store',
  'aether-games-fleet',
];
const RANGE = ['#00aeff', '#e8b923', '#5eead4', '#c084fc', '#fb7185'];

const CONFIG = {
  background: 'transparent',
  axis: {
    domainColor: '#4a5d73',
    tickColor: '#4a5d73',
    labelColor: '#9eb0c7',
    gridColor: '#1e2c3d',
    titleColor: '#c5d4e8',
    labelAngle: 0,
  },
  legend: { labelColor: '#c5d4e8', titleColor: '#c5d4e8', orient: 'bottom' },
  view: { stroke: null },
  title: { color: '#f4f7fb', fontSize: 14, anchor: 'start', offset: 4, fontWeight: 600 },
};

function esql(query) {
  return {
    '%type%': 'esql',
    '%timefield%': '@timestamp',
    query,
  };
}

function spec(title, extra) {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    title,
    autosize: { type: 'fit', contains: 'padding' },
    config: CONFIG,
    ...extra,
  };
}

const VIS = [
  {
    id: 'aether-vega-span-volume',
    title: 'Aether Vega · Span volume',
    spec: spec('Span volume by service', {
      data: {
        url: esql(
          `FROM traces-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | STATS spans = COUNT(*) BY service = service.name | SORT spans DESC | LIMIT 8`,
        ),
      },
      mark: { type: 'bar', cornerRadiusEnd: 2, tooltip: true, color: '#00aeff' },
      encoding: {
        y: {
          field: 'service',
          type: 'nominal',
          sort: null,
          title: null,
          axis: { labelLimit: 180 },
        },
        x: { field: 'spans', type: 'quantitative', title: null },
      },
    }),
  },
  {
    id: 'aether-vega-log-volume',
    title: 'Aether Vega · Log volume',
    spec: spec('Log lines by service', {
      data: {
        url: esql(
          `FROM logs-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | STATS lines = COUNT(*) BY service = service.name | SORT lines DESC | LIMIT 8`,
        ),
      },
      mark: { type: 'bar', cornerRadiusEnd: 2, tooltip: true, color: '#e8b923' },
      encoding: {
        y: {
          field: 'service',
          type: 'nominal',
          sort: null,
          title: null,
          axis: { labelLimit: 180 },
        },
        x: { field: 'lines', type: 'quantitative', title: null },
      },
    }),
  },
  {
    id: 'aether-vega-span-timeline',
    title: 'Aether Vega · Launch window',
    spec: spec('Spans over time', {
      data: {
        url: esql(
          `FROM traces-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | STATS spans = COUNT(*) BY service = service.name, bucket = DATE_TRUNC(5 minutes, @timestamp) | SORT bucket ASC`,
        ),
      },
      mark: { type: 'line', strokeWidth: 2.4, interpolate: 'monotone', tooltip: true },
      encoding: {
        x: {
          field: 'bucket',
          type: 'temporal',
          title: null,
          axis: { labelAngle: 0, tickCount: 8 },
        },
        y: { field: 'spans', type: 'quantitative', title: null },
        color: {
          field: 'service',
          type: 'nominal',
          scale: { domain: DOMAIN, range: RANGE },
          legend: { title: null, orient: 'bottom' },
        },
      },
    }),
  },
  {
    id: 'aether-vega-span-heatmap',
    title: 'Aether Vega · Density',
    spec: spec('Traffic density', {
      data: {
        url: esql(
          `FROM traces-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | STATS spans = COUNT(*) BY service = service.name, bucket = DATE_TRUNC(15 minutes, @timestamp)`,
        ),
      },
      mark: { type: 'rect', tooltip: true },
      encoding: {
        x: {
          field: 'bucket',
          type: 'temporal',
          title: null,
          axis: { labelAngle: 0, tickCount: 6 },
        },
        y: {
          field: 'service',
          type: 'nominal',
          sort: DOMAIN,
          title: null,
          axis: { labelLimit: 180 },
        },
        color: {
          field: 'spans',
          type: 'quantitative',
          scale: { range: ['#102033', '#00aeff'] },
          legend: { title: 'spans', orient: 'bottom' },
        },
      },
    }),
  },
  {
    id: 'aether-vega-failures',
    title: 'Aether Vega · Failures',
    spec: spec('Failed spans + error logs', {
      data: {
        url: esql(
          `FROM traces-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | WHERE event.outcome == "failure" OR http.response.status_code >= 500 | STATS failures = COUNT(*) BY service = service.name | SORT failures DESC | LIMIT 8`,
        ),
      },
      mark: { type: 'bar', cornerRadiusEnd: 2, tooltip: true, color: '#fb7185' },
      encoding: {
        y: {
          field: 'service',
          type: 'nominal',
          sort: null,
          title: null,
          axis: { labelLimit: 180 },
        },
        x: { field: 'failures', type: 'quantitative', title: null },
      },
    }),
  },
  {
    id: 'aether-vega-metric-points',
    title: 'Aether Vega · Metric points',
    spec: spec('Metric samples by service', {
      data: {
        url: esql(
          `FROM metrics-* | WHERE @timestamp >= ?_tstart AND @timestamp <= ?_tend | WHERE ${SVC} | STATS samples = COUNT(*) BY service = service.name | SORT samples DESC | LIMIT 8`,
        ),
      },
      mark: { type: 'bar', cornerRadiusEnd: 2, tooltip: true, color: '#5eead4' },
      encoding: {
        y: {
          field: 'service',
          type: 'nominal',
          sort: null,
          title: null,
          axis: { labelLimit: 180 },
        },
        x: { field: 'samples', type: 'quantitative', title: null },
      },
    }),
  },
];

const LAYOUT = [
  { visualization: 'aether-vega-span-volume', x: 0, y: 0, w: 24, h: 12 },
  { visualization: 'aether-vega-log-volume', x: 24, y: 0, w: 24, h: 12 },
  { visualization: 'aether-vega-span-timeline', x: 0, y: 12, w: 48, h: 13 },
  { visualization: 'aether-vega-span-heatmap', x: 0, y: 25, w: 24, h: 12 },
  { visualization: 'aether-vega-failures', x: 24, y: 25, w: 24, h: 12 },
  { visualization: 'aether-vega-metric-points', x: 0, y: 37, w: 48, h: 10 },
];

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i);
    let v = t.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function kibanaFromEs(esUrl) {
  const base = String(esUrl || '').replace(/\/$/, '');
  if (base.includes('.kb.')) return base;
  if (base.includes('.es.')) return base.replace('.es.', '.kb.');
  return base;
}

function visAttributes(title, specObj) {
  const visState = { title, type: 'vega', params: { spec: JSON.stringify(specObj) }, aggs: [] };
  return {
    title,
    visState: JSON.stringify(visState),
    uiStateJSON: '{}',
    description: '',
    kibanaSavedObjectMeta: { searchSourceJSON: '{}' },
  };
}

function dashboardAttributes() {
  const panels = [];
  const references = [];
  LAYOUT.forEach((p, i) => {
    const panelRefName = `panel_${i}`;
    panels.push({
      embeddableConfig: { hidePanelTitles: true },
      gridData: { x: p.x, y: p.y, w: p.w, h: p.h, i: String(i + 1) },
      panelIndex: String(i + 1),
      panelRefName,
      type: 'visualization',
    });
    references.push({ id: p.visualization, name: panelRefName, type: 'visualization' });
  });
  return {
    attributes: {
      title: 'Aether — Launch ops',
      description:
        'Vega launch-window board for matchmaking, auth, session-gateway, store, and aether-games-fleet. Seed OTLP from the Aether Games demo, then set Last 24h.',
      panelsJSON: JSON.stringify(panels),
      optionsJSON: JSON.stringify({
        useMargins: true,
        syncColors: true,
        syncTooltips: true,
        syncCursor: true,
      }),
      timeRestore: true,
      timeFrom: 'now-24h',
      timeTo: 'now',
      kibanaSavedObjectMeta: { searchSourceJSON: '{}' },
    },
    references,
  };
}

async function importObjects(kibana, apiKey, objects) {
  const ndjson = objects.map((o) => JSON.stringify(o)).join('\n');
  const blob = new Blob([ndjson], { type: 'application/x-ndjson' });
  const form = new FormData();
  form.append('file', blob, 'aether-launch-ops.ndjson');
  const res = await fetch(`${kibana}/api/saved_objects/_import?overwrite=true`, {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      'kbn-xsrf': 'true',
      'x-elastic-internal-origin': 'kibana',
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.success !== false, status: res.status, data };
}

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
loadEnvFile(resolve(root, 'demo/.env.local'));
loadEnvFile(resolve(root, 'demo/.env'));

const esUrl = (process.env.ES_URL || process.env.VITE_ES_URL || '').trim();
const apiKey = (process.env.ES_API_KEY || process.env.KIBANA_API_KEY || '').trim();
const kibana = ((process.env.KIBANA_URL || '').trim() || kibanaFromEs(esUrl)).replace(/\/$/, '');

if (!kibana || !apiKey) {
  console.error('Need ES_URL/KIBANA_URL and ES_API_KEY (demo/.env.local)');
  process.exit(1);
}

const dash = dashboardAttributes();
const objects = [
  ...VIS.map((v) => ({
    type: 'visualization',
    id: v.id,
    attributes: visAttributes(v.title, v.spec),
    references: [],
  })),
  {
    type: 'dashboard',
    id: DASH_ID,
    attributes: dash.attributes,
    references: dash.references,
  },
];

const result = await importObjects(kibana, apiKey, objects);
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`OK: ${kibana}/app/dashboards#/view/${DASH_ID}?_g=(time:(from:now-24h,to:now))`);
if (result.data?.successCount != null) console.log(`imported ${result.data.successCount} objects`);
if (result.data?.errors?.length) console.error('errors', result.data.errors);
