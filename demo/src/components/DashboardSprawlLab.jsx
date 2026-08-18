import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, AlertTriangle, Radio } from 'lucide-react';
import { ModuleHeader, StatCard, DeepLinkBar, PrimaryCta, GhostCta } from './ui';
import {
  getO11yKibanaUrl,
  kibanaHostLabel,
  kibanaDashboardViewUrl,
  kibanaWorkflowUrl,
  kibanaManagementRuleUrl,
  kibanaDashboardsUrl,
  HORIZON_SPRAWL_DASHBOARD_ID,
  DASHBOARD_SCHEMA_DRIFT_WORKFLOW_ID,
  DASHBOARD_SCHEMA_DRIFT_RULE_ID,
} from '../lib/elastic-api';

const FOLDER = [
  { id: 'mm', title: 'Aether — Matchmaking', owner: 'unassigned', fields: 'wait_seconds, region' },
  { id: 'sg', title: 'Aether — Session gateway', owner: 'platform', fields: 'http_request_duration_seconds' },
  { id: 'auth', title: 'Aether — Auth & login', owner: 'identity', fields: 'aether_auth_logins_total' },
  { id: 'store', title: 'Aether — Store checkout', owner: 'unassigned', fields: 'checkout_duration_seconds' },
  { id: 'slo', title: 'Aether — Launch window SLO', owner: 'sre', fields: 'error_budget_remaining' },
  { id: 'deps', title: 'Aether — Dependency latency', owner: 'unassigned', fields: 'dependency_duration_seconds' },
];

const STEPS = [
  { id: 'relabel', label: 'Relabel drops region / renames duration metric' },
  { id: 'blank', label: 'Matchmaking + session widgets go blank' },
  { id: 'page', label: 'SRE paged: “the dashboard is broken”' },
  { id: 'inventory', label: 'Elastic inventory: boards → indexes they query' },
  { id: 'probe', label: 'Workflow KEEP-probes widget fields every 15m' },
];

const statusColor = {
  pending: 'text-mist/40',
  running: 'text-amber',
  done: 'text-cyan',
};

export function DashboardSprawlLab() {
  const kibana = getO11yKibanaUrl();
  const project = kibanaHostLabel(kibana);
  const sprawlHref = kibanaDashboardViewUrl(kibana, HORIZON_SPRAWL_DASHBOARD_ID);
  const workflowHref = kibanaWorkflowUrl(kibana, DASHBOARD_SCHEMA_DRIFT_WORKFLOW_ID);
  const ruleHref = kibanaManagementRuleUrl(kibana, DASHBOARD_SCHEMA_DRIFT_RULE_ID);
  const listHref = kibanaDashboardsUrl(kibana);

  const [phase, setPhase] = useState('idle');
  const [blank, setBlank] = useState({});
  const [boards, setBoards] = useState(FOLDER.length);
  const [watched, setWatched] = useState(0);
  const [drift, setDrift] = useState(0);
  const [steps, setSteps] = useState(STEPS.map((s) => ({ ...s, status: 'pending' })));
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

  function reset() {
    clearTimers();
    setPhase('idle');
    setBlank({});
    setBoards(FOLDER.length);
    setWatched(0);
    setDrift(0);
    setSteps(STEPS.map((s) => ({ ...s, status: 'pending' })));
    setLog([]);
  }

  function runBreakage() {
    clearTimers();
    setPhase('running');
    setBlank({});
    setBoards(FOLDER.length);
    setWatched(0);
    setDrift(0);
    setSteps(STEPS.map((s) => ({ ...s, status: 'pending' })));
    setLog([]);
    pushLog('Launch week — Grafana folder still has last season’s boards');

    schedule(() => {
      setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: 'running' } : s)));
      pushLog('Prom relabel: drop label region; rename http_request_duration_seconds');
    }, 700);

    schedule(() => {
      setBlank({ mm: true, sg: true, deps: true });
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'running' } : s)),
      );
      pushLog('WIDGET BLANK: Matchmaking wait by region — no data');
      pushLog('WIDGET BLANK: Session gateway avg connect — Unknown column');
    }, 1600);

    schedule(() => {
      setSteps((prev) =>
        prev.map((s, i) => (i === 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'running' } : s)),
      );
      pushLog('PAGE: #launch-sre — “the dashboard is broken” — not an index outage');
    }, 2400);

    schedule(() => {
      setBoards(14);
      setWatched(80);
      setSteps((prev) =>
        prev.map((s, i) => (i === 2 ? { ...s, status: 'done' } : i === 3 ? { ...s, status: 'running' } : s)),
      );
      pushLog('Elastic inventory: Aether boards → metrics-* (live dashboard definitions)');
    }, 3400);

    schedule(() => {
      setDrift(3);
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i === 3) return { ...s, status: 'done' };
          if (i === 4) return { ...s, status: 'running' };
          return s;
        }),
      );
      pushLog('Workflow: FROM metrics-* | KEEP `region` | LIMIT 1 → on-failure → dashboard-schema-drift');
    }, 4400);

    schedule(() => {
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setPhase('done');
      pushLog('Alert: schema drift impacting widgets — throttle 1h. Open Horizon — Dashboard sprawl');
    }, 5400);
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="Broken widgets"
        title="Launch-week boards. Then a relabel blanks them."
        subtitle="Grafana folders nobody owns. A dropped region label or renamed duration metric silently empties matchmaking and session widgets. Elastic inventories which Aether boards still query which indexes — and alerts before SRE is paged for a blank graph."
        actions={
          <div className="flex flex-wrap gap-3">
            <PrimaryCta onClick={phase === 'running' ? undefined : runBreakage} disabled={phase === 'running'}>
              <Radio className="w-4 h-4" />
              Simulate schema break
            </PrimaryCta>
            <GhostCta onClick={reset} disabled={phase === 'idle'}>
              Reset
            </GhostCta>
            <GhostCta href={sprawlHref}>Open Horizon — Dashboard sprawl</GhostCta>
          </div>
        }
      >
        <DeepLinkBar
          links={[
            { label: 'Horizon — Dashboard sprawl', href: sprawlHref, primary: true },
            { label: 'Schema drift workflow', href: workflowHref },
            { label: 'Drift alert rule', href: ruleHref },
            { label: 'All dashboards', href: listHref },
          ]}
        />
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10 rise-in">
        <StatCard label="Launch-week boards" value={boards} trend="Grafana folder + Kibana after migrate" />
        <StatCard
          label="Blank widgets"
          value={Object.keys(blank).length}
          accent="amber"
          trend={phase === 'idle' ? 'Healthy until relabel' : 'Matchmaking / session / deps'}
        />
        <StatCard
          label="Fields watched"
          value={watched}
          href={sprawlHref}
          trend="dashboard-widget-fields"
        />
        <StatCard
          label="Schema drift"
          value={drift}
          accent={drift ? 'amber' : 'cyan'}
          href={ruleHref}
          trend="KEEP probe failed (24h sim)"
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-10 mb-10 rise-in-delay-2">
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase">
              Grafana folder — launch week
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-mist">
              {project}
            </span>
          </div>
          <ul className="divide-y divide-white/8 border-t border-white/10">
            {FOLDER.map((b) => {
              const dead = Boolean(blank[b.id]);
              return (
                <li key={b.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className={`font-display text-sm font-semibold ${dead ? 'text-amber' : 'text-fog'}`}>
                      {b.title}
                    </p>
                    <p className="text-[11px] text-mist mt-0.5 font-mono">
                      {b.fields}
                      {b.owner === 'unassigned' ? ' · no owner' : ` · ${b.owner}`}
                    </p>
                  </div>
                  {dead ? (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Blank
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-mist shrink-0">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Live
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-mist mt-4 leading-relaxed max-w-lg">
            Simulation for the POV. Live inventory on{' '}
            <span className="font-mono text-cyan">{project}</span> is rebuilt from dashboard
            definitions — 242 boards on the fixed O11Y project, Aether boards on each Instruqt play.
          </p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-4">
            Elastic response
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
          <p className="text-mist/45">Event log — simulate a schema break</p>
        ) : (
          log.map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </div>
  );
}
