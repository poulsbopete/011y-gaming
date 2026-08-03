import { Section } from './ui';

/**
 * Proof points adapted from Elastic Observability company preso
 * (metrics launch / columnar / PromQL / migrate slides around #14).
 * https://elastic.github.io/observability-team/collaterals/observability-presentation/company-preso.html#14
 */
const STATS = [
  {
    value: '30×',
    label: 'Faster queries',
    detail: 'vs Prometheus & Mimir — Elasticsearch 9.4 columnar metrics benchmarks',
  },
  {
    value: '4×',
    label: 'Lower TCO',
    detail: 'vs Datadog-class metrics spend — consumption that follows player peaks',
  },
  {
    value: '0',
    label: 'Dashboard rewrites',
    detail: 'Keep Grafana boards, PromQL, and alerting intent — Elastic as the faster backend',
  },
  {
    value: '3.75 B',
    label: 'Per data point',
    detail: 'Down from ~25 bytes — columnar layout, 6.6× less metrics storage',
  },
];

const PILLARS = [
  {
    title: 'PromQL your SREs already speak',
    body: 'About 80% of queries in the top Grafana dashboards run natively in Kibana — rate, sum by, max_over_time — no plugins. Same language, up to 30× faster.',
  },
  {
    title: 'Columnar physics, not caching tricks',
    body: 'Field-per-column reads and delta encoding shrink metrics footprints and cut wasted scans. Faster queries mean faster launch-night investigations.',
  },
  {
    title: 'Migrate overnight, not over quarters',
    body: 'Connect Grafana or Datadog, convert dashboards and alert rules automatically, go live in Kibana the same day — the Instruqt path Aether Games walks.',
  },
];

export function WhyElasticSection() {
  return (
    <Section
      id="why-elastic"
      eyebrow="Why Elastic"
      title="Proof points for platform metrics"
      lead="Engineers don't change tools — we meet them where they are. Elastic becomes the metrics backend: faster, cheaper, unified with logs and traces."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 mb-14">
        {STATS.map((s) => (
          <div key={s.label} className="border-t border-cyan/30 pt-4">
            <p className="font-display text-4xl md:text-5xl font-extrabold text-cyan tracking-tight">{s.value}</p>
            <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">{s.label}</p>
            <p className="mt-2 text-xs text-mist leading-relaxed">{s.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-10 md:gap-8">
        {PILLARS.map((p) => (
          <div key={p.title}>
            <h3 className="font-display text-lg font-bold text-fog mb-2">{p.title}</h3>
            <p className="text-mist text-sm leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 text-xs text-mist/60 max-w-3xl">
        Figures from Elastic Observability metrics benchmarks (ES 9.4 / columnar engine) and company presentation collaterals.
        Competitive claims vs Prometheus, Mimir, ClickHouse, and Datadog as published by Elastic.
      </p>
    </Section>
  );
}
