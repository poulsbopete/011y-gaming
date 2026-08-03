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
  const meta = MODULES.find((m) => m.id === active);

  return (
    <div className="min-h-screen bg-arena text-fog">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-arena/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <button
              type="button"
              onClick={() => setActive('launch')}
              className="font-display text-lg font-extrabold tracking-tight text-fog"
            >
              Aether <span className="text-cyan">Games</span>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {MODULES.map((mod) => {
                const on = active === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActive(mod.id)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      on ? 'bg-white/10 text-fog font-medium' : 'text-mist hover:text-fog hover:bg-white/5'
                    }`}
                  >
                    {mod.label}
                    {mod.live && !on && <span className="ml-1.5 text-[10px] text-cyan">●</span>}
                    {mod.live && on && <span className="ml-1.5 text-[10px] text-cyan animate-pulse">●</span>}
                  </button>
                );
              })}
            </nav>

            <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-wider text-mist">
              <span className={`w-1.5 h-1.5 rounded-full ${meta?.live ? 'bg-cyan animate-pulse' : 'bg-mist/40'}`} />
              {meta?.live ? 'Interactive demo' : 'POV module'}
            </div>

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
          <nav className="md:hidden border-t border-white/10 px-6 py-3 space-y-1 bg-arena">
            {MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  setActive(mod.id);
                  setMobileOpen(false);
                }}
                className={`block w-full text-left py-2 text-base ${
                  active === mod.id ? 'text-fog font-semibold' : 'text-mist'
                }`}
              >
                {mod.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 md:py-14">
        {active === 'architecture' ? <ArchitectureSection embedded /> : <Active />}
      </main>

      <footer className="border-t border-white/8 px-6 py-10">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-display font-bold text-fog">Aether Games</p>
            <p className="text-xs text-mist mt-1">Fictional AAA publisher · Elastic Observability + Security demo</p>
          </div>
          {invite ? (
            <a href={invite} target="_blank" rel="noopener noreferrer" className="text-sm text-cyan hover:text-amber">
              Instruqt workshop →
            </a>
          ) : (
            <a
              href="https://play.instruqt.com/manage/elastic/tracks/aether-games-metrics-adoption"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-cyan hover:text-amber"
            >
              Instruqt track →
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
