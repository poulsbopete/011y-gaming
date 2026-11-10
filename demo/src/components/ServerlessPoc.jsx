import { Crosshair, Gauge, Search, Shield } from 'lucide-react';
import { ModuleHeader, PrimaryCta, GhostCta, DeepLinkBar } from './ui';
import {
  getO11yKibanaUrl,
  getSecurityKibanaUrl,
  kibanaWorkflowsLibraryUrl,
  kibanaWorkflowUrl,
  kibanaDashboardViewUrl,
  HORIZON_SPRAWL_DASHBOARD_ID,
  BROKEN_WIDGET_HUNTER_WORKFLOW_ID,
  LAUNCH_NIGHT_WORKFLOW_ID,
} from '../lib/elastic-api';

const PILLARS = [
  {
    icon: Gauge,
    name: 'Observability',
    why: 'Launch windows need metrics, traces, and logs without owning Prometheus / Grafana / Loki stacks.',
    criteria: [
      'Grafana / PromQL boards live on Serverless in ≤1 day',
      'Launch-night workflow: seed OTLP → ES|QL → brief under 5 minutes',
      'Broken Widget Hunter (Template Library) opens a Case when widgets break',
      'Timed investigate path beats current on-prem tool-hopping',
    ],
  },
  {
    icon: Shield,
    name: 'Security',
    why: 'ATO, payment abuse, and session hijack during launches must hit SOC with O11Y context.',
    criteria: [
      'Fraud alerts land in Security Serverless with entity context',
      'Signal → case in under 2 minutes on the demo path',
      'O11Y ↔ Security correlation proven on one launch scenario',
      'SOC reviews detection pack for production candidates',
    ],
  },
  {
    icon: Search,
    name: 'Search',
    why: 'Player support, wiki, and catalog discovery without self-managing clusters.',
    criteria: [
      'One Search Serverless project indexes an agreed Blizzard corpus',
      'Relevance bake-off vs current (BM25 + semantic / rerank)',
      'Ingest → query latency SLO met under POC load',
      'Owner sign-off for that search surface',
    ],
  },
];

const WEEKS = [
  {
    when: 'W1 · Nov 10–14',
    focus: 'Align + stand up',
    body: 'Champions, three Serverless projects, walk the gated POV (launch + broken widgets + fraud).',
  },
  {
    when: 'W2 · Nov 17–21',
    focus: 'Observability prove',
    body: 'Migrate boards, OTLP path, Broken Widget Hunter + launch-night accepted by SRE.',
  },
  {
    when: 'W3 · Nov 24–26',
    focus: 'Security + Search',
    body: 'Detection → case, O11Y↔Security correlation, Search corpus + relevance bake-off.',
  },
  {
    when: 'W4 · Dec 1–5',
    focus: 'Decision',
    body: 'Timed drills vs criteria, TCO vs on-prem ops, go / no-go + Q1 pilot scope.',
  },
];

export function ServerlessPoc() {
  const kibana = getO11yKibanaUrl();
  const security = getSecurityKibanaUrl();
  const libraryHref = kibanaWorkflowsLibraryUrl(kibana);
  const hunterHref = kibanaWorkflowUrl(kibana, BROKEN_WIDGET_HUNTER_WORKFLOW_ID);
  const launchHref = kibanaWorkflowUrl(kibana, LAUNCH_NIGHT_WORKFLOW_ID);
  const sprawlHref = kibanaDashboardViewUrl(kibana, HORIZON_SPRAWL_DASHBOARD_ID);

  return (
    <div>
      <ModuleHeader
        eyebrow="November Serverless POC"
        title="Prove Observability, Security, and Search on Elastic Serverless."
        subtitle="Move launch-critical o11y, fraud/SOC workflows, and one search use case off on-prem cluster ops — with written success criteria and a Dec 5 go / no-go."
        actions={
          <div className="flex flex-wrap gap-3">
            <PrimaryCta href={libraryHref}>
              <Crosshair className="w-4 h-4" />
              Workflows Template Library
            </PrimaryCta>
            <GhostCta href={hunterHref}>Broken Widget Hunter</GhostCta>
            <GhostCta href={security}>Open Security project</GhostCta>
          </div>
        }
      >
        <DeepLinkBar
          links={[
            { label: 'Broken Widget Hunter', href: hunterHref, primary: true },
            { label: 'Template Library', href: libraryHref },
            { label: 'Launch-night workflow', href: launchHref },
            { label: 'Horizon — Dashboard sprawl', href: sprawlHref },
          ]}
        />
      </ModuleHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="border-t border-cyan/30 pt-4">
          <p className="font-display text-3xl font-extrabold text-cyan tracking-tight">3</p>
          <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">Pillars</p>
          <p className="mt-2 text-xs text-mist leading-relaxed">O11Y · Security · Search</p>
        </div>
        <div className="border-t border-cyan/30 pt-4">
          <p className="font-display text-3xl font-extrabold text-cyan tracking-tight">~4 wks</p>
          <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">November</p>
          <p className="mt-2 text-xs text-mist leading-relaxed">Kickoff → Dec 5 decision</p>
        </div>
        <div className="border-t border-cyan/30 pt-4">
          <p className="font-display text-3xl font-extrabold text-cyan tracking-tight">Product</p>
          <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">Widget Hunter</p>
          <p className="mt-2 text-xs text-mist leading-relaxed">Template Library workflow — not a one-off POV script</p>
        </div>
        <div className="border-t border-cyan/30 pt-4">
          <p className="font-display text-3xl font-extrabold text-cyan tracking-tight">Exit</p>
          <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">Go / no-go</p>
          <p className="mt-2 text-xs text-mist leading-relaxed">Scorecard + Q1 pilot scope</p>
        </div>
      </div>

      <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-6">
        Why leave on-prem
      </h2>
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div>
          <h3 className="font-display text-lg font-bold text-fog mb-2">Blizzard pressure</h3>
          <p className="text-mist text-sm leading-relaxed">
            Launch windows punish tool-hopping across metrics, logs, traces, and SOC. On-prem estates
            burn SRE cycles on upgrades and capacity instead of player-facing reliability. Fraud and
            account abuse spike with concurrent players — Security needs the same timeline as Observability.
          </p>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-fog mb-2">Why Elastic Serverless</h3>
          <p className="text-mist text-sm leading-relaxed">
            Managed scale per project (O11Y / Security / Search), Grafana migrate into live boards the
            same day, and product workflows — including <span className="text-fog">Broken Widget Hunter</span> from
            the Template Library — so schema drift becomes a Case, not a war room.
          </p>
        </div>
      </div>

      <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-6">
        Success criteria
      </h2>
      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        {PILLARS.map(({ icon: Icon, name, why, criteria }) => (
          <div key={name} className="border-t border-white/12 pt-5">
            <Icon className="w-5 h-5 text-cyan mb-3" strokeWidth={1.5} />
            <h3 className="font-display text-lg font-bold text-fog mb-2">{name}</h3>
            <p className="text-mist text-sm leading-relaxed mb-4">{why}</p>
            <ol className="space-y-2">
              {criteria.map((c, i) => (
                <li key={c} className="flex gap-2 text-sm text-fog/90 leading-snug">
                  <span className="font-mono text-[11px] text-cyan tabular-nums shrink-0 pt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <h2 className="font-display text-sm font-bold text-fog tracking-wide uppercase mb-6">
        Timeline
      </h2>
      <ul className="divide-y divide-white/8 border-t border-white/10 mb-12">
        {WEEKS.map((w) => (
          <li key={w.when} className="py-4 grid sm:grid-cols-[10rem_8rem_1fr] gap-2 sm:gap-4">
            <span className="font-mono text-[11px] text-cyan uppercase tracking-wide">{w.when}</span>
            <span className="font-display text-sm font-semibold text-fog">{w.focus}</span>
            <span className="text-sm text-mist leading-relaxed">{w.body}</span>
          </li>
        ))}
      </ul>

      <div className="border-t border-white/10 pt-6 grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="font-display text-sm font-bold text-fog uppercase tracking-wide mb-2">Ask today</h3>
          <p className="text-mist text-sm leading-relaxed">
            Confirm three champions (O11Y / Security / Search), one production-shaped dataset or label
            set per pillar, and a Dec 5 decision meeting.
          </p>
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-fog uppercase tracking-wide mb-2">Next in this POV</h3>
          <p className="text-mist text-sm leading-relaxed">
            Walk <span className="text-fog">Launch night</span>, then{' '}
            <span className="text-fog">Broken widgets</span> — the hunter is shipping as an Elastic
            product workflow, not a custom demo script.
          </p>
        </div>
      </div>
    </div>
  );
}
