import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, AlertTriangle, Radio, Sparkles } from 'lucide-react';
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
  {
    id: 'mm',
    title: 'Aether — Matchmaking',
    source: 'Grafana',
    owner: 'unassigned',
    fields: 'wait_seconds, region',
    repairedFields: 'wait_seconds, labels.region',
  },
  {
    id: 'sg',
    title: 'Aether — Session gateway',
    source: 'Datadog',
    owner: 'platform',
    fields: 'http_request_duration_seconds',
    repairedFields: 'http.server.request.duration',
  },
  {
    id: 'auth',
    title: 'Aether — Auth & login',
    source: 'Grafana',
    owner: 'identity',
    fields: 'aether_auth_logins_total',
    repairedFields: 'aether_auth_logins_total',
  },
  {
    id: 'store',
    title: 'Aether — Store checkout',
    source: 'Datadog',
    owner: 'unassigned',
    fields: 'checkout_duration_seconds',
    repairedFields: 'checkout_duration_seconds',
  },
  {
    id: 'slo',
    title: 'Aether — Launch window SLO',
    source: 'Grafana',
    owner: 'sre',
    fields: 'error_budget_remaining',
    repairedFields: 'error_budget_remaining',
  },
  {
    id: 'deps',
    title: 'Aether — Dependency latency',
    source: 'Datadog',
    owner: 'unassigned',
    fields: 'dependency_duration_seconds',
    repairedFields: 'dependency.duration',
  },
];

const STEPS = [
  { id: 'live', label: 'Grafana + Datadog boards already live on Observability Serverless' },
  { id: 'dev', label: 'Engineers ship a rename / drop a label — nobody filed a ticket' },
  { id: 'blank', label: 'Matchmaking + session widgets go blank in Kibana' },
  { id: 'detect', label: 'KEEP probes fail; Horizon flags the fields those widgets still query' },
  { id: 'ai', label: 'Agent Builder maps old fields → what is actually in the index' },
  { id: 'repair', label: 'AI remaps the widget queries — panels live again' },
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
  const [repaired, setRepaired] = useState({});
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
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 10));
  }

  function reset() {
    clearTimers();
    setPhase('idle');
    setBlank({});
    setRepaired({});
    setBoards(FOLDER.length);
    setWatched(0);
    setDrift(0);
    setSteps(STEPS.map((s) => ({ ...s, status: 'pending' })));
    setLog([]);
  }

  function markStep(doneIdx, runningIdx) {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i === doneIdx) return { ...s, status: 'done' };
        if (i === runningIdx) return { ...s, status: 'running' };
        return s;
      }),
    );
  }

  function runBreakage() {
    clearTimers();
    setPhase('running');
    setBlank({});
    setRepaired({});
    setBoards(FOLDER.length);
    setWatched(0);
    setDrift(0);
    setSteps(STEPS.map((s) => ({ ...s, status: 'pending' })));
    setLog([]);

    schedule(() => {
      setBoards(14);
      setSteps((prev) => prev.map((s, i) => (i === 0 ? { ...s, status: 'running' } : s)));
      pushLog('Cutover complete — Grafana + Datadog launch boards now Kibana on Observability Serverless');
    }, 400);

    schedule(() => {
      markStep(0, 1);
      pushLog('Unexpected schema change: matchmaking drops `region`; session gateway renames duration — no changelog');
    }, 1400);

    schedule(() => {
      setBlank({ mm: true, sg: true, deps: true });
      markStep(1, 2);
      pushLog('WIDGET BLANK (Kibana): Matchmaking wait by region — no data');
      pushLog('WIDGET BLANK (Kibana): Session gateway avg connect — Unknown column');
    }, 2300);

    schedule(() => {
      setWatched(80);
      setDrift(3);
      markStep(2, 3);
      pushLog('DETECT: FROM metrics-* | KEEP `region` | LIMIT 1 → fail → dashboard-schema-drift');
      pushLog('Horizon: 3 widgets still query fields that are no longer in the index');
    }, 3300);

    schedule(() => {
      markStep(3, 4);
      pushLog('Agent Builder: `region` last present as `labels.region`; duration as `http.server.request.duration`');
    }, 4400);

    schedule(() => {
      markStep(4, 5);
      pushLog('AI remapping widget ES|QL on Matchmaking, Session gateway, Dependency latency');
    }, 5400);

    schedule(() => {
      setBlank({});
      setRepaired({ mm: true, sg: true, deps: true });
      setDrift(0);
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setPhase('done');
      pushLog('KEEP probes passing — 3 widgets restored by AI. Open Horizon — Dashboard sprawl');
    }, 6500);
  }

  const blankCount = Object.keys(blank).length;
  const repairedCount = Object.keys(repaired).length;

  return (
    <div>
      <ModuleHeader
        eyebrow="Broken widgets"
        title="Developers change schema. Elastic detects it. AI remaps the widgets."
        subtitle="Schema changes are not in the launch plan — but game and platform engineers rename metrics and drop labels all the time. After Grafana and Datadog boards live on Observability Serverless, KEEP probes catch the blank widgets; Agent Builder maps old fields to what is actually in the index and remaps the queries."
        actions={
          <div className="flex flex-wrap gap-3">
            <PrimaryCta onClick={phase === 'running' ? undefined : runBreakage} disabled={phase === 'running'}>
              <Radio className="w-4 h-4" />
              Simulate a silent schema change
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
        <StatCard label="Migrated boards" value={boards} trend="Grafana + Datadog → Kibana" />
        <StatCard
          label="Blank widgets"
          value={blankCount}
          accent={blankCount ? 'amber' : undefined}
          trend={
            phase === 'idle'
              ? 'Healthy after cutover'
              : phase === 'done'
                ? `${repairedCount} remapped by AI`
                : 'Matchmaking / session / deps'
          }
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
          trend={phase === 'done' ? 'KEEP probes passing after AI remap' : 'Unexpected — KEEP probe failed'}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-10 mb-10 rise-in-delay-2">
        <div className="lg:col-span-3">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase">
              Elastic Serverless — after migrate
            </h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-mist">
              {project}
            </span>
          </div>
          <ul className="divide-y divide-white/8 border-t border-white/10">
            {FOLDER.map((b) => {
              const dead = Boolean(blank[b.id]);
              const fixed = Boolean(repaired[b.id]);
              return (
                <li key={b.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className={`font-display text-sm font-semibold ${dead ? 'text-amber' : 'text-fog'}`}>
                      {b.title}
                    </p>
                    <p className="text-[11px] text-mist mt-0.5 font-mono">
                      {fixed ? b.repairedFields : b.fields}
                      {' · from '}
                      {b.source}
                      {b.owner === 'unassigned' ? ' · no owner' : ` · ${b.owner}`}
                    </p>
                  </div>
                  {dead ? (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-amber shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Blank
                    </span>
                  ) : fixed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-cyan shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI remapped
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
            Simulation for the POV. Detection is the KEEP probe + Horizon inventory on{' '}
            <span className="font-mono text-cyan">{project}</span>. Remap is Agent Builder
            against live Kibana dashboard definitions.
          </p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-4">
            Detect + AI remap
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
          <p className="text-mist/45">Event log — unexpected schema change, then AI remap</p>
        ) : (
          log.map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </div>
  );
}
