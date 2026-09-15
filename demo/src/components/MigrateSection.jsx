import { ModuleHeader } from './ui';
import { LayoutDashboard, Bell, Plug } from 'lucide-react';
import { getInstruqtInviteUrl } from '../lib/elastic-api';

const POINTS = [
  {
    icon: LayoutDashboard,
    title: 'Migrate Grafana boards',
    body: 'One script converts Grafana / PromQL dashboards onto Observability Serverless. Layout and query intent stay — they go live as Kibana boards the same day.',
  },
  {
    icon: Bell,
    title: 'Bring Alertmanager with you',
    body: 'Alerting definitions migrate as Kibana rule drafts (disabled until you own them). Same thresholds, same paging intent — not a rewrite of the on-call catalog.',
  },
  {
    icon: Plug,
    title: 'Or keep Grafana pointed at Elastic',
    body: 'Not ready to leave Grafana? Use Elastic as the PromQL metrics backend. Teams keep the UI they know while queries, cost, and launch-night scale sit on Serverless.',
  },
];

export function MigrateSection() {
  const invite = getInstruqtInviteUrl();
  return (
    <div>
      <ModuleHeader
        eyebrow="Grafana + Alertmanager → Elastic"
        title="Convert the estate — or just retarget Grafana"
        subtitle="Platform teams do not have to redraw boards. Migrate Grafana dashboards and Alertmanager definitions into Kibana, or keep Grafana and point it at Elastic as the metrics store."
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
