import { useState } from 'react';
import { Play, Radio, Workflow } from 'lucide-react';
import { ModuleHeader, StatCard, DeepLinkBar, PrimaryCta, GhostCta } from './ui';
import {
  getO11yKibanaUrl,
  kibanaHostLabel,
  kibanaDiscoverUrl,
  kibanaObservabilityServicesUrl,
  kibanaApmServiceUrl,
  kibanaDashboardsUrl,
  kibanaRulesUrl,
  kibanaMetricsUrl,
  kibanaWorkflowUrl,
  AETHER_AUTH_ESQL,
  AETHER_DISCOVER_ESQL,
  AETHER_TRACES_ESQL,
  LAUNCH_NIGHT_WORKFLOW_ID,
} from '../lib/elastic-api';

const WORKFLOW_STEPS = [
  { id: 'metrics', label: 'ES|QL probe metrics-* (matchmaking / auth / session)' },
  { id: 'traces', label: 'ES|QL probe traces-* (APM spans by service)' },
  { id: 'logs', label: 'ES|QL probe logs-* (continue if empty)' },
  { id: 'agent', label: 'Agent Builder writes the launch-night brief' },
  { id: 'index', label: 'Index the brief to aether-launch-night-runs' },
];

function buildSeries() {
  return Array.from({ length: 24 }, (_, i) => 80 + Math.sin(i / 2.2) * 18 + (i % 5) * 3);
}

function Sparkline({ series, accent = '#00aeff' }) {
  const w = 320;
  const h = 72;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export function LaunchNightDemo() {
  const kibana = getO11yKibanaUrl();
  const project = kibanaHostLabel(kibana);
  const discoverHref = kibanaDiscoverUrl(kibana, { query: AETHER_DISCOVER_ESQL });
  const tracesHref = kibanaDiscoverUrl(kibana, { query: AETHER_TRACES_ESQL });
  const apmHref = kibanaObservabilityServicesUrl(kibana);
  const matchmakingHref = kibanaApmServiceUrl(kibana, 'matchmaking');
  const dashboardsHref = kibanaDashboardsUrl(kibana);
  const rulesHref = kibanaRulesUrl(kibana);
  const metricsHref = kibanaMetricsUrl(kibana);
  const workflowHref = kibanaWorkflowUrl(kibana, LAUNCH_NIGHT_WORKFLOW_ID);

  const [series] = useState(() => buildSeries());
  const [seeding, setSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [executionId, setExecutionId] = useState(null);
  const [log, setLog] = useState([]);
  const [stepStatus, setStepStatus] = useState('pending');

  function pushLog(msg) {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 10));
  }

  async function runWorkflow() {
    setRunning(true);
    setExecutionId(null);
    setStepStatus('running');
    pushLog('POST Kibana workflow Aether — Launch night incident');
    try {
      const r = await fetch('/api/run-launch-night', { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      const href = body.executionHref || body.workflowHref || workflowHref;
      if (!r.ok) {
        pushLog(`Workflow: ${body.error || r.status} — open Kibana and click Run`);
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      setExecutionId(body.executionId || null);
      pushLog(
        body.executionId
          ? `Execution ${body.executionId} — watch steps in Kibana (not this ticker)`
          : 'Workflow started — watch steps in Kibana',
      );
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    } catch (e) {
      pushLog(`Workflow error: ${e instanceof Error ? e.message : String(e)}`);
      window.open(workflowHref, '_blank', 'noopener,noreferrer');
    } finally {
      setRunning(false);
    }
  }

  async function seedMetrics() {
    setSeeding(true);
    try {
      const r = await fetch('/api/seed-metrics', { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        pushLog(`Seed failed: ${body.error || r.status}`);
        return;
      }
      pushLog(`${body.message || 'Seeded traces'} → then Run launch-night workflow`);
    } catch (e) {
      pushLog(`Seed error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSeeding(false);
    }
  }

  const statusColor = {
    pending: 'text-mist/50',
    running: 'text-cyan',
    completed: 'text-amber',
  };

  const links = [
    { href: workflowHref, label: 'Launch-night workflow', primary: true },
    { href: discoverHref, label: 'Discover' },
    { href: apmHref, label: 'APM' },
    { href: matchmakingHref, label: 'Matchmaking' },
    { href: metricsHref, label: 'Metrics' },
    { href: tracesHref, label: 'Traces' },
    { href: dashboardsHref, label: 'Dashboards' },
    { href: rulesHref, label: 'Rules' },
  ];

  return (
    <div>
      <ModuleHeader
        eyebrow="Launch night"
        title="Metrics, traces, and logs in one launch window"
        subtitle="Do not play a fake 6-second incident. Seed live OTLP, then run the Kibana workflow — it probes metrics-*, traces-*, and logs-*, then Agent Builder writes the triage. Watch the execution in Elastic."
        actions={
          <div className="flex flex-wrap gap-3">
            <PrimaryCta onClick={runWorkflow} disabled={running}>
              <Workflow className="w-4 h-4" />
              {running ? 'Starting in Elastic…' : 'Run launch-night workflow'}
            </PrimaryCta>
            <GhostCta href={workflowHref}>Open workflow</GhostCta>
            <GhostCta onClick={seedMetrics} disabled={seeding}>
              <Radio className="w-4 h-4" />
              {seeding ? 'Seeding…' : 'Seed live metrics'}
            </GhostCta>
          </div>
        }
      >
        <DeepLinkBar links={links} label={`Kibana · ${project}`} />
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 mb-10 rise-in-delay">
        <StatCard
          label="Concurrent players"
          value="184,200"
          trend="Discover services"
          href={discoverHref}
        />
        <StatCard
          label="Matchmaking"
          value="APM"
          trend="Transactions after seed"
          href={matchmakingHref}
        />
        <StatCard
          label="Auth"
          value="ES|QL"
          trend="Auth in Discover"
          href={kibanaDiscoverUrl(kibana, { query: AETHER_AUTH_ESQL })}
        />
        <StatCard
          label="Workflow"
          value={executionId ? 'Running' : 'Manual'}
          trend={executionId ? String(executionId).slice(0, 12) : 'aether-launch-night'}
          href={workflowHref}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-10 mb-10 rise-in-delay-2">
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase">
              Matchmaking wait
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-mist">Illustration</span>
          </div>
          <Sparkline series={series} />
          <p className="text-xs text-mist mt-4 leading-relaxed max-w-lg">
            Sparkline is illustration only. Real latency and throughput are in APM after seed.
            The workflow on{' '}
            <span className="font-mono text-cyan">{project}</span> is the source of truth.
          </p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-4">
            Elastic workflow
          </h2>
          <ol className="space-y-3">
            {WORKFLOW_STEPS.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className={`font-mono text-[11px] tabular-nums pt-0.5 ${statusColor[stepStatus]}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={stepStatus === 'pending' ? 'text-mist/60' : 'text-fog'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 font-mono text-[11px] text-mist space-y-1.5 min-h-[6.5rem]">
        {log.length === 0 ? (
          <p className="text-mist/45">Seed telemetry, then run the Kibana workflow — it will not finish in 6 seconds</p>
        ) : (
          log.map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </div>
  );
}
