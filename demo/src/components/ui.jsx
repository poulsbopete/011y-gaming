import { ExternalLink, ArrowRight } from 'lucide-react';

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

export function PrimaryCta({ href, children, external = true }) {
  const Tag = href ? 'a' : 'span';
  const props = href
    ? external
      ? { href, target: '_blank', rel: 'noopener noreferrer' }
      : { href }
    : {};
  return (
    <Tag
      {...props}
      className="inline-flex items-center gap-2 rounded-md bg-cyan px-5 py-2.5 font-display text-sm font-bold text-arena hover:bg-amber transition-colors"
    >
      {children}
      <ArrowRight className="w-4 h-4" />
    </Tag>
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
