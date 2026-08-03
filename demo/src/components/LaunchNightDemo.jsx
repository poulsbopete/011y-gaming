import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Radio } from 'lucide-react';
import { ModuleHeader, StatCard, DeepLinkBar, PrimaryCta, GhostCta } from './ui';
import {
  getO11yKibanaUrl,
  kibanaHostLabel,
  kibanaDiscoverUrl,
  kibanaObservabilityServicesUrl,
  kibanaApmServiceUrl,
  kibanaDashboardsUrl,
  kibanaRulesUrl,
  kibanaMetricsExplorerUrl,
  AETHER_AUTH_ESQL,
  AETHER_DISCOVER_ESQL,
  AETHER_TRACES_ESQL,
} from '../lib/elastic-api';

const WORKFLOW_STEPS = [
  { id: 'detect', label: 'Detect matchmaking p95 spike' },
  { id: 'correlate', label: 'Correlate auth failures + session gateway' },
  { id: 'a2a', label: 'A2A hint → Security fraud agent' },
  { id: 'remediate', label: 'Scale session-gateway / shed queue' },
  { id: 'verify', label: 'Verify SLO burn recovering' },
];

function buildSeries(points, spikeAt) {
  return Array.from({ length: points }, (_, i) => {
    const base = 80 + Math.sin(i / 2.2) * 18 + (i % 5) * 3;
    if (spikeAt != null && i >= spikeAt) return base + 220 + (i - spikeAt) * 12;
    return base;
  });
}

function Sparkline({ series, accent = '#2dd4bf', animate }) {
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
        className={animate ? 'spark-line' : undefined}
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
  const metricsHref = kibanaMetricsExplorerUrl(kibana);
  const [phase, setPhase] = useState('idle');
  const [series, setSeries] = useState(() => buildSeries(24, null));
  const [players, setPlayers] = useState(184_200);
  const [queue, setQueue] = useState(420);
  const [authFail, setAuthFail] = useState(1.2);
  const [steps, setSteps] = useState(WORKFLOW_STEPS.map((s) => ({ ...s, status: 'pending' })));
  const [log, setLog] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function schedule(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  }

  useEffect(() => () => clearTimers(), []);

  function pushLog(msg) {
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 8));
  }

  function runIncident() {
    clearTimers();
    setPhase('running');
    setSteps(WORKFLOW_STEPS.map((s) => ({ ...s, status: 'pending' })));
    setLog([]);
    setSeries(buildSeries(24, null));
    setPlayers(184_200);
    setQueue(420);
    setAuthFail(1.2);
    pushLog('Launch window open — US-West + EU evening peak');

    schedule(() => {
      setSeries(buildSeries(24, 14));
      setQueue(2680);
      setPlayers(241_800);
      pushLog('ALERT: matchmaking wait p95 > 12s across us-west');
      setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: 'running' } : s)));
    }, 900);

    schedule(() => {
      setAuthFail(8.4);
      pushLog('Auth failure rate elevated — possible credential stuffing');
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          status: i === 0 ? 'completed' : i === 1 ? 'running' : 'pending',
        })),
      );
    }, 2200);

    schedule(() => {
      pushLog('A2A federation stub → Security fraud correlator');
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          status: i <= 1 ? 'completed' : i === 2 ? 'running' : 'pending',
        })),
      );
    }, 3400);

    schedule(() => {
      pushLog('Remediation: scale session-gateway + shed matchmaking queue');
      setQueue(910);
      setSeries(buildSeries(24, null).map((v, i) => (i > 16 ? v + 40 : v)));
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          status: i <= 2 ? 'completed' : i === 3 ? 'running' : 'pending',
        })),
      );
    }, 4600);

    schedule(() => {
      setAuthFail(2.1);
      setQueue(380);
      setPlayers(198_400);
      setSeries(buildSeries(24, null));
      pushLog('SLO burn recovering — launch window stabilized');
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
      setPhase('resolved');
    }, 6000);
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
      pushLog(`Seeded metrics+traces → ${project} (wait ~30s, then open APM)`);
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
    { href: discoverHref, label: 'Discover', primary: true },
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
        title="Run a launch-window incident"
        subtitle="Walk matchmaking spike → auth correlation → A2A Security hint → remediation. Seed live telemetry, then open the same story in Kibana."
        actions={
          <div className="flex flex-wrap gap-3">
            <PrimaryCta onClick={runIncident} disabled={phase === 'running'}>
              {phase === 'running' ? (
                'Running…'
              ) : phase === 'resolved' ? (
                <>
                  <RotateCcw className="w-4 h-4" /> Replay demo
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Run launch-night demo
                </>
              )}
            </PrimaryCta>
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
          value={players.toLocaleString()}
          trend={phase === 'running' ? 'Evening peak surge' : 'Discover services'}
          href={discoverHref}
        />
        <StatCard
          label="Matchmaking queue"
          value={queue.toLocaleString()}
          trend={queue > 1500 ? 'Elevated wait' : 'APM matchmaking'}
          accent={queue > 1500 ? 'amber' : 'cyan'}
          href={matchmakingHref}
        />
        <StatCard
          label="Auth failure"
          value={authFail.toFixed(1)}
          unit="%"
          trend={authFail > 5 ? 'Spike — investigate' : 'Auth in Discover'}
          accent={authFail > 5 ? 'amber' : 'cyan'}
          href={kibanaDiscoverUrl(kibana, { query: AETHER_AUTH_ESQL })}
        />
        <StatCard
          label="Incident phase"
          value={phase === 'idle' ? 'Ready' : phase === 'running' ? 'Active' : 'Resolved'}
          trend="APM inventory"
          href={apmHref}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-10 mb-10 rise-in-delay-2">
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase">
              Matchmaking wait
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-mist">
              {phase === 'running' ? 'Live spike' : 'Simulated'}
            </span>
          </div>
          <Sparkline
            series={series}
            accent={phase === 'running' ? '#e8a838' : '#2dd4bf'}
            animate={phase !== 'idle'}
          />
          <p className="text-xs text-mist mt-4 leading-relaxed max-w-lg">
            Chart is simulated for the POV. After seeding, APM and Discover show real OTLP data in{' '}
            <span className="font-mono text-cyan">{project}</span>.
          </p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-4">
            Remediation
          </h2>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-3 text-sm">
                <span className={`font-mono text-[11px] tabular-nums pt-0.5 ${statusColor[s.status]}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={s.status === 'pending' ? 'text-mist/60' : 'text-fog'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4 font-mono text-[11px] text-mist space-y-1.5 min-h-[6.5rem]">
        {log.length === 0 ? (
          <p className="text-mist/45">Event log — run the launch-night demo</p>
        ) : (
          log.map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </div>
  );
}
