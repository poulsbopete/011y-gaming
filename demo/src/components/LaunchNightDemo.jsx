import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { ModuleHeader, StatCard, DeepLinkBar, PrimaryCta } from './ui';
import {
  getO11yKibanaUrl,
  kibanaDiscoverUrl,
  kibanaObservabilityServicesUrl,
  kibanaDashboardsUrl,
  kibanaRulesUrl,
  AETHER_AUTH_ESQL,
  AETHER_MATCHMAKING_ESQL,
  AETHER_DISCOVER_ESQL,
} from '../lib/elastic-api';

const WORKFLOW_STEPS = [
  { id: 'detect', label: 'Detect matchmaking p95 spike' },
  { id: 'correlate', label: 'Correlate auth failures + session gateway' },
  { id: 'a2a', label: 'A2A hint → Security fraud agent (stub)' },
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

function Sparkline({ series, accent = '#22d3ee' }) {
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export function LaunchNightDemo() {
  const kibana = getO11yKibanaUrl();
  const [phase, setPhase] = useState('idle'); // idle | running | resolved
  const [series, setSeries] = useState(() => buildSeries(24, null));
  const [players, setPlayers] = useState(184_200);
  const [queue, setQueue] = useState(420);
  const [authFail, setAuthFail] = useState(1.2);
  const [steps, setSteps] = useState(WORKFLOW_STEPS.map((s) => ({ ...s, status: 'pending' })));
  const [log, setLog] = useState([]);
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

  const statusColor = {
    pending: 'bg-white/10 text-mist',
    running: 'bg-cyan/20 text-cyan',
    completed: 'bg-amber/20 text-amber',
  };

  return (
    <div>
      <ModuleHeader
        eyebrow="Launch night"
        title="Run a launch-window incident"
        subtitle="One click walks matchmaking spike → auth correlation → A2A Security hint → remediation. Then open the same story in live Kibana."
      >
        <DeepLinkBar
          links={[
            { href: kibanaDiscoverUrl(kibana, { query: AETHER_MATCHMAKING_ESQL }), label: 'Discover', primary: true },
            { href: kibanaObservabilityServicesUrl(kibana), label: 'APM' },
            { href: kibanaDashboardsUrl(kibana), label: 'Dashboards' },
            { href: kibanaRulesUrl(kibana), label: 'Rules' },
          ]}
        />
        <PrimaryCta onClick={runIncident} disabled={phase === 'running'}>
          {phase === 'running' ? (
            'Running…'
          ) : phase === 'resolved' ? (
            <>
              <RotateCcw className="w-4 h-4" /> Replay
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Run launch-night demo
            </>
          )}
        </PrimaryCta>
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Concurrent players"
          value={players.toLocaleString()}
          trend={phase === 'running' ? 'Evening peak surge' : 'Global online'}
          href={kibanaDiscoverUrl(kibana, { query: AETHER_DISCOVER_ESQL })}
        />
        <StatCard
          label="Matchmaking queue"
          value={queue.toLocaleString()}
          trend={queue > 1500 ? 'Elevated — players waiting' : 'Healthy'}
          accent={queue > 1500 ? 'amber' : 'cyan'}
          href={kibanaDiscoverUrl(kibana, { query: AETHER_MATCHMAKING_ESQL })}
        />
        <StatCard
          label="Auth failure %"
          value={authFail.toFixed(1)}
          unit="%"
          trend={authFail > 5 ? 'Spike — correlate with Security' : 'Baseline'}
          accent={authFail > 5 ? 'amber' : 'cyan'}
          href={kibanaDiscoverUrl(kibana, { query: AETHER_AUTH_ESQL })}
        />
        <StatCard
          label="Incident phase"
          value={phase === 'idle' ? 'Ready' : phase === 'running' ? 'Active' : 'Resolved'}
          trend="Simulated choreography"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-3 rounded-xl border border-white/10 bg-arena-elevated/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-bold text-fog">Matchmaking wait (p95 proxy)</h3>
            <span className="text-[10px] uppercase tracking-wider text-mist">
              {phase === 'running' ? 'Live spike' : 'Synthetic series'}
            </span>
          </div>
          <Sparkline series={series} accent={phase === 'running' ? '#fbbf24' : '#22d3ee'} />
          <p className="text-xs text-mist mt-3">
            Click a KPI to open Discover with gaming ES|QL. Charts are simulated for the POV; Kibana shows the live project.
          </p>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-arena-elevated/80 p-5">
          <h3 className="font-display text-sm font-bold text-fog mb-4">Remediation workflow</h3>
          <ol className="space-y-2.5">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${statusColor[s.status]}`}>
                  {s.status}
                </span>
                <span className="text-mist">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-arena/60 p-4 font-mono text-[11px] text-mist space-y-1 min-h-[7rem]">
        {log.length === 0 ? (
          <p className="text-mist/50">Event log — press Run launch-night demo</p>
        ) : (
          log.map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </div>
  );
}
