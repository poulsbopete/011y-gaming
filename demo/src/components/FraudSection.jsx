import { Section, ExtLink } from './ui';
import { getSecurityEsUrl, kibanaSecurityUrl } from '../lib/elastic-api';

const THREATS = [
  'Credential stuffing against account platforms',
  'Multi-account abuse on shared devices',
  'Payment fraud on digital storefronts',
  'Session hijack during competitive seasons',
];

export function FraudSection() {
  const es = getSecurityEsUrl();
  const links = [
    { label: 'Security overview', href: kibanaSecurityUrl('overview') },
    { label: 'Alerts', href: kibanaSecurityUrl('alerts') },
    { label: 'Cases', href: kibanaSecurityUrl('cases') },
    { label: 'Detection rules', href: kibanaSecurityUrl('rules') },
    { label: 'Entity analytics', href: kibanaSecurityUrl('entityAnalytics') },
    { label: 'Attacks', href: kibanaSecurityUrl('attacks') },
  ];

  return (
    <Section
      id="fraud"
      eyebrow="Account fraud"
      title="Elastic Security for the player economy"
      lead="Gaming platforms fight account takeover and payment abuse daily. Correlate O11Y auth spikes with Security detections — live project below."
    >
      <ul className="mb-10 space-y-2 text-sm text-mist">
        {THREATS.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-amber">▸</span>
            {t}
          </li>
        ))}
      </ul>
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
