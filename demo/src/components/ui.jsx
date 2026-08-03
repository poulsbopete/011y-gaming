import { ExternalLink } from 'lucide-react';

export function ExtLink({ href, children, className = '' }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-cyan hover:text-amber transition-colors ${className}`}
    >
      {children}
      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
    </a>
  );
}

export function PrimaryCta({ href, children, external = true, onClick, disabled }) {
  if (onClick || !href) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md bg-cyan px-5 py-2.5 font-display text-sm font-bold text-arena hover:bg-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </button>
    );
  }
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-2 rounded-md bg-cyan px-5 py-2.5 font-display text-sm font-bold text-arena hover:bg-amber transition-colors"
    >
      {children}
    </a>
  );
}

export function GhostCta({ href, children, external = true }) {
  if (!href) return null;
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-2.5 font-display text-sm text-fog hover:border-cyan hover:text-cyan transition-colors"
    >
      {children}
    </a>
  );
}

export function ModuleHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="mb-8 md:mb-10">
      {eyebrow && (
        <p className="text-xs uppercase tracking-[0.2em] text-amber mb-3 font-medium">{eyebrow}</p>
      )}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-fog tracking-tight">{title}</h1>
          {subtitle && <p className="text-mist mt-3 max-w-2xl text-base leading-relaxed">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-3 shrink-0">{children}</div>}
      </div>
    </header>
  );
}

export function StatCard({ label, value, unit, trend, href, accent = 'cyan' }) {
  const accentClass = accent === 'amber' ? 'text-amber' : 'text-cyan';
  const inner = (
    <>
      {href && (
        <span className="absolute top-3 right-3 text-mist/50 group-hover:text-cyan">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      )}
      <p className="text-[11px] uppercase tracking-wider text-mist">{label}</p>
      <p className={`font-display text-2xl md:text-3xl font-bold mt-1 ${accentClass} animate-count`}>
        {value}
        {unit && <span className="text-sm font-normal text-mist ml-1">{unit}</span>}
      </p>
      {trend && <p className="text-xs text-mist mt-2 leading-snug">{trend}</p>}
    </>
  );

  const cls =
    'group relative block rounded-xl border border-white/10 bg-arena-elevated/80 p-4 hover:border-cyan/40 transition-colors text-left w-full';

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function DeepLinkBar({ links }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.filter((l) => l.href).map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            l.primary
              ? 'bg-cyan text-arena hover:bg-amber'
              : 'border border-white/15 text-mist hover:border-cyan hover:text-cyan'
          }`}
        >
          {l.label}
          <ExternalLink className="w-3 h-3" />
        </a>
      ))}
    </div>
  );
}

/** Scroll-page section wrapper (kept for Architecture / legacy sections if needed) */
export function Section({ id, eyebrow, title, lead, children }) {
  return (
    <section id={id} className="relative px-6 py-20 md:py-28 border-t border-white/8">
      <div className="mx-auto max-w-5xl">
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.2em] text-amber mb-3 font-medium">{eyebrow}</p>
        )}
        <h2 className="font-display text-3xl md:text-4xl font-bold text-fog mb-3">{title}</h2>
        {lead && <p className="text-mist max-w-2xl text-base md:text-lg mb-10 leading-relaxed">{lead}</p>}
        {children}
      </div>
    </section>
  );
}
