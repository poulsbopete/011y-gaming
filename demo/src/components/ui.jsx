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
  const cls =
    'inline-flex items-center justify-center gap-2 rounded-md bg-cyan px-5 py-2.5 font-display text-sm font-bold text-arena hover:bg-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  if (onClick || !href) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={cls}>
      {children}
    </a>
  );
}

export function GhostCta({ href, children, external = true, onClick, disabled }) {
  const cls =
    'inline-flex items-center justify-center gap-2 rounded-md border border-white/18 px-5 py-2.5 font-display text-sm text-fog hover:border-cyan hover:text-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  if (onClick || !href) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cls}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={cls}>
      {children}
    </a>
  );
}

/** Stacked module intro — title full-width, actions + deep links below (no transform clip). */
export function ModuleHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <header className="mb-8 md:mb-10 overflow-visible">
      <div className="rise-in">
        {eyebrow && (
          <p className="text-[11px] uppercase tracking-[0.22em] text-amber mb-3 font-medium">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl md:text-[2.75rem] font-bold text-fog tracking-tight leading-[1.15] max-w-3xl pb-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-mist mt-4 max-w-2xl text-[15px] md:text-base leading-relaxed">{subtitle}</p>
        )}
        {actions && <div className="mt-6">{actions}</div>}
      </div>
      {children && <div className="mt-5 overflow-visible">{children}</div>}
    </header>
  );
}

export function StatCard({ label, value, unit, trend, href, accent = 'cyan' }) {
  const accentClass = accent === 'amber' ? 'text-amber' : 'text-cyan';
  const inner = (
    <>
      {href && (
        <span className="absolute top-3 right-3 text-mist/40 group-hover:text-cyan transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-mist">{label}</p>
      <p className={`font-display text-2xl md:text-[1.75rem] font-bold mt-2 tabular-nums ${accentClass} animate-count`}>
        {value}
        {unit && <span className="text-sm font-normal text-mist ml-1">{unit}</span>}
      </p>
      {trend && <p className="text-xs text-mist/80 mt-2 leading-snug">{trend}</p>}
    </>
  );

  const cls =
    'group relative block border-t border-white/12 pt-4 pr-6 pb-1 text-left w-full hover:border-cyan/50 transition-colors';

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function DeepLinkBar({ links, label = 'Open in Elastic' }) {
  const items = links.filter((l) => l.href);
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4 overflow-visible py-1">
      <span className="text-[10px] uppercase tracking-[0.16em] text-mist shrink-0 leading-none pt-0.5">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-4 gap-y-2.5 overflow-visible">
        {items.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-sm leading-normal transition-colors ${
              l.primary ? 'text-cyan hover:text-amber font-medium' : 'text-mist hover:text-fog'
            }`}
          >
            {l.label}
            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
          </a>
        ))}
      </div>
    </div>
  );
}

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
