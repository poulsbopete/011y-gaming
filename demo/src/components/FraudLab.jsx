import { useEffect, useState, useCallback } from 'react';
import { Shield, AlertTriangle, FolderOpen, Crosshair } from 'lucide-react';
import { ModuleHeader, DeepLinkBar, PrimaryCta } from './ui';
import { kibanaSecurityUrl, getSecurityKibanaUrl } from '../lib/elastic-api';

const SEED_ALERTS = [
  {
    id: 'ALT-88421',
    severity: 'critical',
    title: 'Credential stuffing — account platform',
    entity: 'player:aether-user-88421',
    signal: 'auth_failure_spike + known bad IP',
    region: 'us-west',
  },
  {
    id: 'ALT-1204',
    severity: 'high',
    title: 'Multi-account abuse — shared device',
    entity: 'device:fp-9c2a',
    signal: '12 new accounts / 18m',
    region: 'eu-west',
  },
  {
    id: 'ALT-5510',
    severity: 'high',
    title: 'Payment fraud — stolen instrument',
    entity: 'payment:tok_stub',
    signal: 'checkout velocity anomaly',
    region: 'us-east',
  },
  {
    id: 'ALT-330',
    severity: 'medium',
    title: 'Session hijack candidate',
    entity: 'session:sgw-77af',
    signal: 'geo hop mid-match',
    region: 'apac',
  },
];

const SEV = {
  critical: 'text-red-300 bg-red-500/15',
  high: 'text-amber bg-amber/15',
  medium: 'text-mist bg-white/10',
};

export function FraudLab() {
  const [alerts, setAlerts] = useState(SEED_ALERTS);
  const [selected, setSelected] = useState(SEED_ALERTS[0]);
  const [caseNote, setCaseNote] = useState(null);
  const [isolated, setIsolated] = useState(null);
  const [seedMsg, setSeedMsg] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const refresh = useCallback(() => {
    setAlerts((prev) =>
      prev.map((a, i) =>
        i === Math.floor(Math.random() * prev.length)
          ? { ...a, id: `${a.id.split('-')[0]}-${Math.floor(1000 + Math.random() * 9000)}` }
          : a,
      ),
    );
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  function openCase() {
    if (!selected) return;
    setCaseNote({
      title: selected.title,
      id: `CASE-${Math.floor(10000 + Math.random() * 89999)}`,
      status: 'open',
    });
  }

  function isolateHost() {
    if (!selected) return;
    setIsolated(selected.entity);
  }

  async function seedLiveFraud() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await fetch('/api/seed-fraud', { method: 'POST' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSeedMsg(body.error || `Seed failed (${r.status})`);
        return;
      }
      setSeedMsg(body.message || 'Seeded fraud alerts.');
    } catch (e) {
      setSeedMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <ModuleHeader
        eyebrow="Account fraud"
        title="Investigate gaming fraud signals"
        subtitle="Triage simulated alerts here, seed live Security alerts, then continue in Kibana. Attack Discovery needs an LLM connector after Alerts populate."
        actions={
          <PrimaryCta onClick={seedLiveFraud} disabled={seeding}>
            {seeding ? 'Seeding…' : 'Seed live Security alerts'}
          </PrimaryCta>
        }
      >
        <DeepLinkBar
          label="Security"
          links={[
            { href: kibanaSecurityUrl('alerts'), label: 'Alerts', primary: true },
            { href: kibanaSecurityUrl('cases'), label: 'Cases' },
            { href: kibanaSecurityUrl('entityAnalytics'), label: 'Entity analytics' },
            { href: kibanaSecurityUrl('attackDiscovery'), label: 'Attack discovery' },
          ]}
        />
      </ModuleHeader>

      {seedMsg && (
        <p className="mb-6 text-sm text-amber border border-amber/30 rounded-md px-4 py-3">
          {seedMsg}{' '}
          <a
            href={kibanaSecurityUrl('alerts')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan hover:text-amber"
          >
            Open Alerts →
          </a>
        </p>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-xl border border-white/10 bg-arena-elevated/80 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-fog flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber" /> Live alert feed
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-mist">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /> Simulated
            </span>
          </div>
          <ul className="divide-y divide-white/8">
            {alerts.map((a) => {
              const active = selected?.id === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(a);
                      setCaseNote(null);
                      setIsolated(null);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      active ? 'bg-amber/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${SEV[a.severity]}`}>
                        {a.severity}
                      </span>
                      <span className="font-mono text-[10px] text-mist">{a.id}</span>
                    </div>
                    <p className="text-sm text-fog font-medium">{a.title}</p>
                    <p className="text-xs text-mist mt-0.5">
                      {a.entity} · {a.region}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-amber/30 bg-arena-elevated/80 p-5 flex flex-col">
          {selected ? (
            <>
              <div className="flex items-start gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display font-bold text-fog">{selected.title}</h3>
                  <p className="text-xs text-mist mt-1 font-mono">{selected.id}</p>
                </div>
              </div>
              <dl className="space-y-2 text-sm mb-6">
                <div className="flex justify-between gap-2">
                  <dt className="text-mist">Entity</dt>
                  <dd className="text-fog font-mono text-xs">{selected.entity}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-mist">O11Y signal</dt>
                  <dd className="text-fog text-xs text-right">{selected.signal}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-mist">Region</dt>
                  <dd className="text-fog">{selected.region}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-mist">Security project</dt>
                  <dd className="text-fog font-mono text-[10px] truncate max-w-[9rem]">
                    {getSecurityKibanaUrl().replace(/^https?:\/\//, '').split('.')[0]}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2 mt-auto">
                <PrimaryCta onClick={openCase}>
                  <FolderOpen className="w-4 h-4" /> Create case (sim)
                </PrimaryCta>
                <button
                  type="button"
                  onClick={isolateHost}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-amber/40 px-4 py-2.5 text-sm text-amber hover:bg-amber/10 transition-colors"
                >
                  <Crosshair className="w-4 h-4" /> Isolate entity (sim)
                </button>
                <a
                  href={kibanaSecurityUrl('cases')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs text-cyan hover:text-amber mt-1"
                >
                  Open live Security Cases →
                </a>
              </div>

              {caseNote && (
                <p className="mt-4 text-xs text-amber border border-amber/30 rounded-md p-3">
                  Case <span className="font-mono">{caseNote.id}</span> opened for “{caseNote.title}”
                  (simulated). Continue in Kibana Cases.
                </p>
              )}
              {isolated && (
                <p className="mt-2 text-xs text-mist border border-white/10 rounded-md p-3">
                  Isolation requested for <span className="font-mono text-fog">{isolated}</span> (simulated).
                </p>
              )}
            </>
          ) : (
            <p className="text-mist text-sm">Select an alert</p>
          )}
        </div>
      </div>
    </div>
  );
}
