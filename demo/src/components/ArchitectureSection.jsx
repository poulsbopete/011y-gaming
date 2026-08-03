import { Activity, Shield, ArrowRight, Download } from 'lucide-react';
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

export function ArchitectureSection() {
  const o11yKibana = getO11yKibanaUrl();
  const o11yEs = getO11yEsUrl().replace(/^https?:\/\//, '');
  const securityEs = getSecurityEsUrl().replace(/^https?:\/\//, '');
  const o11yProject = o11yEs.split('.')[0] || 'otel-demo-a5630c';
  const securityProject = securityEs.split('.')[0] || 'my-security-project-ac9463';

  return (
    <section id="architecture" className="relative px-6 py-20 md:py-28 border-t border-white/8 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 20% 50%, rgba(34,211,238,0.08), transparent), radial-gradient(ellipse 50% 40% at 80% 50%, rgba(251,191,36,0.07), transparent)',
        }}
      />

      <div className="relative mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.2em] text-amber mb-3 font-medium">A2A architecture</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-fog mb-3">
              Observability and Security stay separate projects
            </h2>
            <p className="text-mist max-w-2xl text-base md:text-lg leading-relaxed">
              Cross-boundary correlation uses Agent-to-Agent federation — scoped agent endpoints, not cluster peering.
              Instruqt stubs this; this demo opens the live projects.
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

          <div className="relative grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch">
            {/* Observability panel */}
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

            {/* A2A bridge */}
            <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:px-2">
              <div className="hidden md:block w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              <div className="flex md:flex-col items-center gap-2 a2a-bridge">
                <ArrowRight className="w-5 h-5 text-cyan md:rotate-0 rotate-0" />
                <span className="font-display text-[11px] font-bold uppercase tracking-[0.15em] text-amber whitespace-nowrap">
                  A2A agents
                </span>
                <ArrowRight className="w-5 h-5 text-amber hidden md:block" />
              </div>
              <div className="hidden md:block w-px h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>

            {/* Security panel */}
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

          <p className="relative mt-8 text-center text-xs text-mist/70 max-w-xl mx-auto leading-relaxed">
            Scoped agent endpoints — not CCS. Workshop Lab 2 writes a canned response under{' '}
            <code className="text-cyan/90">build/a2a-stub/</code>. This page opens the real projects.
          </p>
        </div>
      </div>
    </section>
  );
}
