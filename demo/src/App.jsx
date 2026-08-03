import { Hero } from './components/Hero';
import { MigrateSection } from './components/MigrateSection';
import { ObservabilitySection } from './components/ObservabilitySection';
import { FraudSection } from './components/FraudSection';
import { ArchitectureSection } from './components/ArchitectureSection';
import { getInstruqtInviteUrl } from './lib/elastic-api';

export default function App() {
  const invite = getInstruqtInviteUrl();

  return (
    <div className="min-h-screen bg-arena text-fog">
      <Hero />
      <MigrateSection />
      <ObservabilitySection />
      <FraudSection />
      <ArchitectureSection />
      <footer className="border-t border-white/8 px-6 py-12">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-display font-bold text-fog">Aether Games</p>
            <p className="text-xs text-mist mt-1">Fictional AAA publisher · Elastic Observability + Security demo</p>
          </div>
          {invite && (
            <a
              href={invite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan hover:text-amber transition-colors"
            >
              Instruqt workshop invite →
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
