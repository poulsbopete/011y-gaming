import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LaunchNightDemo } from './components/LaunchNightDemo';
import { WhyElasticSection } from './components/WhyElasticSection';
import { MigrateSection } from './components/MigrateSection';
import { FraudLab } from './components/FraudLab';
import { ArchitectureSection } from './components/ArchitectureSection';
import { getInstruqtInviteUrl } from './lib/elastic-api';

const MODULES = [
  { id: 'launch', label: 'Launch night', live: true },
  { id: 'why', label: 'Why Elastic' },
  { id: 'migrate', label: 'Migrate' },
  { id: 'fraud', label: 'Fraud', live: true },
  { id: 'architecture', label: 'A2A' },
];

const MODULE_COMPONENTS = {
  launch: LaunchNightDemo,
  why: WhyElasticSection,
  migrate: MigrateSection,
  fraud: FraudLab,
  architecture: ArchitectureSection,
};

export default function App() {
  const [active, setActive] = useState('launch');
  const [mobileOpen, setMobileOpen] = useState(false);
  const invite = getInstruqtInviteUrl();
  const Active = MODULE_COMPONENTS[active];

  return (
    <div className="min-h-screen app-atmosphere text-fog relative">
      <div className="pointer-events-none absolute inset-0 app-grid" aria-hidden />

      <header className="sticky top-0 z-50 border-b border-white/8 bg-arena/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <button
              type="button"
              onClick={() => setActive('launch')}
              className="font-display text-xl font-extrabold tracking-tight text-fog"
            >
              Aether <span className="text-cyan">Games</span>
            </button>

            <nav className="hidden md:flex items-center gap-0.5">
              {MODULES.map((mod) => {
                const on = active === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActive(mod.id)}
                    className={`px-3 py-2 text-sm transition-colors relative ${
                      on ? 'text-fog font-semibold' : 'text-mist hover:text-fog'
                    }`}
                  >
                    {mod.label}
                    {on && (
                      <span className="absolute bottom-0 left-3 right-3 h-px bg-cyan" />
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              className="md:hidden p-2 text-fog"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="md:hidden border-t border-white/8 px-6 py-4 space-y-1 bg-arena">
            {MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setActive(mod.id);
                  setMobileOpen(false);
                }}
                className={`block w-full text-left py-2.5 text-base ${
                  active === mod.id ? 'text-fog font-semibold' : 'text-mist'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="relative max-w-5xl mx-auto px-6 py-10 md:py-14">
        {active === 'architecture' ? <ArchitectureSection embedded /> : <Active />}
      </main>

      <footer className="relative border-t border-white/8 px-6 py-10 mt-8">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="font-display text-lg font-bold text-fog">
              Aether <span className="text-cyan">Games</span>
            </p>
            <p className="text-xs text-mist mt-1.5 max-w-sm leading-relaxed">
              Fictional AAA publisher · Elastic Observability + Security demo for metrics adoption
            </p>
          </div>
          <a
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan hover:text-amber transition-colors"
          >
            Instruqt workshop →
          </a>
        </div>
      </footer>
    </div>
  );
}
