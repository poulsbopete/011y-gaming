import { PrimaryCta, GhostCta } from './ui';
import { getO11yKibanaUrl, getInstruqtInviteUrl } from '../lib/elastic-api';

export function Hero() {
  const o11y = getO11yKibanaUrl();
  const invite = getInstruqtInviteUrl();

  return (
    <header className="relative min-h-[100svh] flex flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 hero-glow"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 20%, rgba(34,211,238,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(251,191,36,0.12), transparent 50%), linear-gradient(180deg, #070b12 0%, #0a1220 45%, #070b12 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto w-full">
        <div className="font-display text-lg font-extrabold tracking-tight text-fog">
          Aether <span className="text-cyan">Games</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-mist">
          <a href="#migrate" className="hover:text-cyan transition-colors">Migrate</a>
          <a href="#observability" className="hover:text-cyan transition-colors">Observability</a>
          <a href="#fraud" className="hover:text-cyan transition-colors">Fraud</a>
          <a href="#architecture" className="hover:text-cyan transition-colors">Architecture</a>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-24 max-w-6xl mx-auto w-full">
        <p className="rise-in text-xs uppercase tracking-[0.25em] text-cyan mb-5">Elastic × Gaming platforms</p>
        <h1 className="rise-in font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-fog leading-[0.95] max-w-3xl">
          Aether Games
        </h1>
        <p className="rise-in-delay mt-6 text-lg md:text-xl text-mist max-w-xl leading-relaxed">
          Bring Prometheus metrics, Grafana dashboards, and alerts into Elastic — one plane for launch nights, at a better price point.
        </p>
        <div className="rise-in-delay mt-10 flex flex-wrap gap-3">
          <PrimaryCta href={o11y}>Open live Observability</PrimaryCta>
          {invite ? (
            <GhostCta href={invite}>Start Instruqt workshop</GhostCta>
          ) : (
            <GhostCta href="#migrate" external={false}>See the migration path</GhostCta>
          )}
        </div>
        <div className="pulse-line mt-16 h-px max-w-md bg-gradient-to-r from-cyan/80 via-amber/40 to-transparent" />
      </div>
    </header>
  );
}
