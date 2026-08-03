import { ModuleHeader } from './ui';
import { Gauge, Layers, Wallet } from 'lucide-react';
import { getInstruqtInviteUrl } from '../lib/elastic-api';

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
  const invite = getInstruqtInviteUrl();
  return (
    <div>
      <ModuleHeader
        eyebrow="Prom → Elastic"
        title="Meet platform teams where they already work"
        subtitle="Bring Aether Games Prom/Grafana assets into Elastic without a rewrite. Hands-on path is the Instruqt workshop."
      />
      <div className="grid md:grid-cols-3 gap-8 mb-10">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <Icon className="w-6 h-6 text-cyan mb-4" strokeWidth={1.5} />
            <h3 className="font-display text-xl font-bold text-fog mb-2">{title}</h3>
            <p className="text-mist text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-mist max-w-2xl">
        Workshop command:{' '}
        <code className="text-cyan/90 text-xs">bash /root/workshop/scripts/migrate_grafana_dashboards_to_serverless.sh</code>
        {invite && (
          <>
            {' · '}
            <a href={invite} target="_blank" rel="noopener noreferrer" className="text-cyan hover:text-amber">
              Open Instruqt invite →
            </a>
          </>
        )}
      </p>
    </div>
  );
}
