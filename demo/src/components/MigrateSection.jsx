import { Section } from './ui';
import { Gauge, Layers, Wallet } from 'lucide-react';

const POINTS = [
  {
    icon: Layers,
    title: 'Keep what you built',
    body: 'Grafana dashboards, PromQL queries, and alerting rules — all kept. Elastic becomes the backend underneath: faster, cheaper, unified.',
  },
  {
    icon: Gauge,
    title: 'One operations plane',
    body: 'Metrics beside logs and traces on Observability Serverless — one platform, one bill when matchmaking or auth burns on launch night.',
  },
  {
    icon: Wallet,
    title: 'Same-day cutover path',
    body: 'Connect Grafana, auto-convert boards and rules, go live in Kibana — migrate overnight, not over quarters.',
  },
];

export function MigrateSection() {
  return (
    <Section
      id="migrate"
      eyebrow="Prom → Elastic"
      title="Meet platform teams where they already work"
      lead="Engineers don't change tools — we meet them where they are. Bring Aether Games Prom/Grafana assets into Elastic without a rewrite."
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
