import { Activity, Shield, ArrowRight, Download, Link2, Bot } from 'lucide-react';
import { ExtLink } from './ui';
import {
  getO11yKibanaUrl,
  getO11yEsUrl,
  getSecurityEsUrl,
  kibanaSecurityUrl,
  kibanaObservabilityServicesUrl,
} from '../lib/elastic-api';

const O11Y_ITEMS = [
  'metrics / logs / traces',
  'auth failure spikes',
  'anticheat O11Y signals',
];

const SEC_ITEMS = [
  'alerts / cases / UEBA',
  'credential stuffing',
  'multi-account abuse',
];

const NON_ELASTIC_EXAMPLES = [
  'Grafana / Prometheus agents',
  'Datadog or custom SIEM bots',
  'Studio tooling & game backends',
];

export function ArchitectureSection({ embedded = false } = {}) {
  const o11yKibana = getO11yKibanaUrl();
  const o11yEs = getO11yEsUrl().replace(/^https?:\/\//, '');
  const securityEs = getSecurityEsUrl().replace(/^https?:\/\//, '');
  const o11yProject = o11yEs.split('.')[0] || 'otel-demo-a5630c';
  const securityProject = securityEs.split('.')[0] || 'my-security-project-ac9463';

  const shellClass = embedded
    ? 'relative overflow-hidden'
    : 'relative px-6 py-20 md:py-28 border-t border-white/8 overflow-hidden';

  return (
    <section id="architecture" className={shellClass}>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 20% 50%, rgba(34,211,238,0.08), transparent), radial-gradient(ellipse 50% 40% at 80% 50%, rgba(251,191,36,0.07), transparent)',
        }}
      />

      <div className={embedded ? 'relative' : 'relative mx-auto max-w-5xl'}>
        <p className="text-xs uppercase tracking-[0.2em] text-amber mb-3 font-medium">
          Correlation architecture
        </p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-fog mb-3">
              Observability and Security stay separate projects
            </h2>
            <p className="text-mist max-w-2xl text-base md:text-lg leading-relaxed">
              Between Elastic Serverless projects, correlate with{' '}
              <span className="text-fog font-medium">CCS</span>. Reach{' '}
              <span className="text-fog font-medium">non-Elastic</span> systems with{' '}
              <span className="text-fog font-medium">A2A</span> — scoped agent endpoints, not cluster peering.
            </p>
          </div>
          <a
            href="/aether-a2a-architecture.jpg"
            download="aether-a2a-architecture.jpg"
            className="shrink-0 inline-flex items-center gap-2 text-xs text-mist hover:text-cyan transition-colors border border-white/10 px-3 py-2 rounded-md"
          >
            <Download className="w-3.5 h-3.5" />
            Download infographic
          </a>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <div className="rounded-lg border border-cyan/25 bg-arena-elevated/70 px-4 py-3 flex gap-3">
            <Link2 className="w-4 h-4 text-cyan shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-cyan mb-1 font-medium">CCS</p>
              <p className="text-sm text-mist leading-relaxed">
                Elastic Serverless ↔ Elastic Serverless — search and correlate across Observability and Security without merging clusters.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-amber/25 bg-arena-elevated/70 px-4 py-3 flex gap-3">
            <Bot className="w-4 h-4 text-amber shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-amber mb-1 font-medium">A2A</p>
              <p className="text-sm text-mist leading-relaxed">
                Non-Elastic solutions — federate agents into Grafana, Datadog, custom SIEM, or studio backends via scoped endpoints.
              </p>
            </div>
          </div>
        </div>

        {/* Infographic */}
        <div className="relative rounded-2xl border border-white/10 bg-arena-elevated/80 backdrop-blur-sm p-6 md:p-10 overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
            }}
          />

          <p className="relative text-[10px] uppercase tracking-[0.2em] text-mist/80 mb-5 text-center">
            Elastic Serverless — CCS between projects
          </p>

          <div className="relative grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch">
            <article className="relative flex flex-col rounded-xl border border-cyan/40 bg-arena/60 p-5 md:p-6 a2a-panel-o11y">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-cyan" strokeWidth={1.5} />
                <h3 className="font-display text-lg font-bold text-fog">Observability Serverless</h3>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {O11Y_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-mist">
                    <span className="text-cyan mt-0.5">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-cyan/20">
                <p className="text-[10px] uppercase tracking-wider text-cyan/80 mb-1">Demo deep links</p>
                <p className="font-mono text-[11px] text-mist/80 break-all mb-3">{o11yProject}</p>
                <ExtLink href={kibanaObservabilityServicesUrl(o11yKibana)} className="text-xs">
                  Open live O11Y
                </ExtLink>
              </div>
            </article>

            <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:px-2">
              <div className="hidden md:block w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              <div className="flex md:flex-col items-center gap-2 a2a-bridge">
                <ArrowRight className="w-5 h-5 text-cyan" />
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.15em] text-cyan whitespace-nowrap">
                  CCS
                </span>
                <ArrowRight className="w-5 h-5 text-amber hidden md:block" />
              </div>
              <div className="hidden md:block w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>

            <article className="relative flex flex-col rounded-xl border border-amber/40 bg-arena/60 p-5 md:p-6 a2a-panel-sec">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-amber" strokeWidth={1.5} />
                <h3 className="font-display text-lg font-bold text-fog">Security Serverless</h3>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {SEC_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-mist">
                    <span className="text-amber mt-0.5">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-amber/20">
                <p className="text-[10px] uppercase tracking-wider text-amber/80 mb-1">Demo deep links</p>
                <p className="font-mono text-[11px] text-mist/80 break-all mb-3">{securityProject}</p>
                <ExtLink href={kibanaSecurityUrl('alerts')} className="text-xs !text-amber hover:!text-cyan">
                  Open live Security
                </ExtLink>
              </div>
            </article>
          </div>

          <div className="relative mt-8 rounded-xl border border-amber/20 bg-arena/50 px-5 py-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-amber" strokeWidth={1.5} />
              <p className="text-[10px] uppercase tracking-[0.2em] text-amber font-medium">
                A2A — non-Elastic solutions
              </p>
            </div>
            <p className="text-sm text-mist leading-relaxed mb-4 max-w-2xl">
              When fraud or ops signals live outside Elastic, use Agent-to-Agent federation:
              scoped agent endpoints and workflows — not CCS into foreign clusters.
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {NON_ELASTIC_EXAMPLES.map((item) => (
                <li key={item} className="text-sm text-fog/90 flex gap-2">
                  <span className="text-amber">▸</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative mt-6 text-center text-xs text-mist/70 max-w-2xl mx-auto leading-relaxed">
            Instruqt Lab 2 stubs an A2A-style response under{' '}
            <code className="text-cyan/90">build/a2a-stub/</code> (one O11Y project per play).
            This page opens the real Elastic projects — correlate them with CCS in production.
          </p>
        </div>
      </div>
    </section>
  );
}
