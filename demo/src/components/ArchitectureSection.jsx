import { Section } from './ui';

export function ArchitectureSection() {
  return (
    <Section
      id="architecture"
      eyebrow="A2A architecture"
      title="Observability and Security stay separate projects"
      lead="Cross-boundary correlation uses Agent-to-Agent federation today — scoped agent endpoints, not cluster peering. Instruqt stubs this because only one Serverless project can be stood up per play."
    >
      <pre className="overflow-x-auto rounded-lg bg-arena-elevated border border-white/10 p-5 md:p-6 text-xs md:text-sm text-mist font-mono leading-relaxed">
{`┌─────────────────────────┐         ┌─────────────────────────┐
│ Observability Serverless│  A2A    │  Security Serverless    │
│  metrics / logs / traces│ ──────► │  alerts / cases / UEBA  │
│  auth failure spikes    │ agents  │  credential stuffing    │
│  anticheat O11Y signals │         │  multi-account abuse    │
└─────────────────────────┘         └─────────────────────────┘
         ▲                                       ▲
         │ demo deep links                       │ demo deep links
   otel-demo-a5630c                    my-security-project-ac9463`}
      </pre>
      <p className="mt-6 text-sm text-mist max-w-2xl">
        Workshop Lab 2 writes a canned A2A response under <code className="text-cyan text-xs">build/a2a-stub/</code>.
        This page opens the real Security project for live walkthroughs.
      </p>
    </Section>
  );
}
