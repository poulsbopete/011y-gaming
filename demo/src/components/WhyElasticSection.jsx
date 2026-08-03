import { ModuleHeader } from './ui';
import { Gauge, Layers, Wallet } from 'lucide-react';

const STATS = [
  { value: '30×', label: 'Faster queries', detail: 'vs Prometheus & Mimir — ES 9.4 columnar metrics' },
  { value: '4×', label: 'Lower TCO', detail: 'vs Datadog-class metrics spend' },
  { value: '0', label: 'Dashboard rewrites', detail: 'Keep Grafana boards, PromQL, alerting intent' },
  { value: '3.75 B', label: 'Per data point', detail: 'Down from ~25 bytes — 6.6× less metrics storage' },
];

const PILLARS = [
  {
    icon: Layers,
    title: 'PromQL your SREs already speak',
    body: 'About 80% of queries in the top Grafana dashboards run natively in Kibana — same language, up to 30× faster.',
  },
  {
    icon: Gauge,
    title: 'Columnar physics, not caching tricks',
    body: 'Field-per-column reads shrink footprints and cut wasted scans. Faster queries mean faster launch-night investigations.',
  },
  {
    icon: Wallet,
    title: 'Migrate overnight, not over quarters',
    body: 'Connect Grafana, convert boards and rules automatically, go live in Kibana the same day — the Instruqt path.',
  },
];

export function WhyElasticSection() {
  return (
    <div>
      <ModuleHeader
        eyebrow="Why Elastic"
        title="Proof points for platform metrics"
        subtitle="Engineers don't change tools — we meet them where they are. Elastic becomes the metrics backend: faster, cheaper, unified with logs and traces."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {STATS.map((s) => (
          <div key={s.label} className="border-t border-cyan/30 pt-4">
            <p className="font-display text-4xl font-extrabold text-cyan tracking-tight">{s.value}</p>
            <p className="mt-2 font-display text-sm font-bold text-fog uppercase tracking-wide">{s.label}</p>
            <p className="mt-2 text-xs text-mist leading-relaxed">{s.detail}</p>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <Icon className="w-5 h-5 text-cyan mb-3" strokeWidth={1.5} />
            <h3 className="font-display text-lg font-bold text-fog mb-2">{title}</h3>
            <p className="text-mist text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-xs text-mist/60 max-w-3xl">
        Figures from Elastic Observability metrics benchmarks (ES 9.4) and company presentation collaterals.
      </p>
    </div>
  );
}
