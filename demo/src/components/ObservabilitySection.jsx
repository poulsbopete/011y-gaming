import { Section, ExtLink } from './ui';
import {
  getO11yKibanaUrl,
  getO11yEsUrl,
  kibanaDiscoverUrl,
  kibanaDashboardsUrl,
  kibanaObservabilityServicesUrl,
  kibanaStreamsUrl,
  kibanaRulesUrl,
} from '../lib/elastic-api';

export function ObservabilitySection() {
  const kibana = getO11yKibanaUrl();
  const es = getO11yEsUrl();
  const links = [
    { label: 'Discover (ES|QL)', href: kibanaDiscoverUrl(kibana) },
    { label: 'Dashboards', href: kibanaDashboardsUrl(kibana) },
    { label: 'APM services', href: kibanaObservabilityServicesUrl(kibana) },
    { label: 'Streams', href: kibanaStreamsUrl(kibana) },
    { label: 'Alert rules', href: kibanaRulesUrl(kibana) },
  ];

  return (
    <Section
      id="observability"
      eyebrow="Live Observability"
      title="Open the Aether platform project"
      lead="Deep links into the fixed Observability Serverless project used for demos — metrics, services, and dashboards."
    >
      <p className="font-mono text-[11px] text-mist/70 break-all mb-6">{es}</p>
      <ul className="flex flex-col gap-3 max-w-md">
        {links.map((l) => (
          <li key={l.label} className="flex items-center justify-between border-b border-white/8 pb-2">
            <span className="text-sm text-fog">{l.label}</span>
            <ExtLink href={l.href}>Open</ExtLink>
          </li>
        ))}
      </ul>
    </Section>
  );
}
