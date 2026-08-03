import { Section } from './ui';
import { Gauge, Layers, Wallet } from 'lucide-react';

const POINTS = [
  {
    icon: Layers,
    title: 'Keep what you built',
    body: 'PromQL panels and Grafana boards are assets. Migrate intent into Kibana instead of redrawing every chart before the next title launch.',
  },
  {
    icon: Gauge,
    title: 'One operations plane',
    body: 'Metrics land beside logs and traces on Observability Serverless — stop pivoting Grafana mid-incident when matchmaking or auth burns.',
  },
  {
    icon: Wallet,
    title: 'Better price point',
    body: 'Serverless consumption scales with player peaks. Avoid year-round peak provisioning for a metrics stack sized to launch weekends.',
  },
];

export function MigrateSection() {
  return (
    <Section
      id="migrate"
      eyebrow="Prom → Elastic"
      title="Consolidate platform telemetry without a rewrite"
      lead="AAA studios running Prometheus and Grafana can bring dashboards, alerts, and Prom metrics into Elastic Observability — draft-first governance included."
    >
      <div className="grid md:grid-cols-3 gap-10 md:gap-8">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <Icon className="w-6 h-6 text-cyan mb-4" strokeWidth={1.5} />
            <h3 className="font-display text-xl font-bold text-fog mb-2">{title}</h3>
            <p className="text-mist text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-sm text-mist/80 max-w-2xl">
        Hands-on path: the Instruqt workshop migrates fourteen Aether Games Grafana boards onto ephemeral Observability Serverless via{' '}
        <code className="text-cyan/90 text-xs">grafana-migrate</code>.
      </p>
    </Section>
  );
}
