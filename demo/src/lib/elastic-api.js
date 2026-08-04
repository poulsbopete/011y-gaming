const O11Y_DEFAULT = 'https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud';
const SECURITY_DEFAULT = 'https://my-security-project-ac9463.kb.us-central1.gcp.elastic.cloud';
const TIME = { from: 'now-24h', to: 'now' };

// Discover: prefer fleet / gaming services after Vercel OTLP seed.
export const AETHER_DISCOVER_ESQL = [
  'FROM metrics-*',
  '| WHERE service.name IS NOT NULL',
  '| STATS metric_points = COUNT(*) BY service.name',
  '| SORT metric_points DESC',
  '| LIMIT 15',
].join(' ');

export const AETHER_MATCHMAKING_ESQL = [
  'FROM metrics-*',
  '| WHERE service.name == "matchmaking" OR service.name == "aether-games-fleet"',
  '| STATS samples = COUNT(*) BY service.name',
  '| SORT samples DESC',
  '| LIMIT 10',
].join(' ');

export const AETHER_AUTH_ESQL = [
  'FROM metrics-*',
  '| WHERE service.name == "auth" OR service.name == "aether-games-fleet"',
  '| STATS samples = COUNT(*) BY service.name',
  '| SORT samples DESC',
  '| LIMIT 10',
].join(' ');

export const AETHER_TRACES_ESQL = [
  'FROM traces-*',
  '| WHERE service.name IS NOT NULL',
  '| STATS spans = COUNT(*) BY service.name',
  '| SORT spans DESC',
  '| LIMIT 15',
].join(' ');

function risonQuote(str) {
  if (/^[\w\-.*@]+$/.test(str)) return str;
  return `'${String(str).replace(/'/g, "!'")}'`;
}

function risonEncode(value) {
  if (value === null || value === undefined) return '!n';
  if (value === true) return '!t';
  if (value === false) return '!f';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return risonQuote(value);
  if (Array.isArray(value)) {
    return value.length ? `!(${value.map(risonEncode).join(',')})` : '!()';
  }
  if (typeof value === 'object') {
    return `(${Object.entries(value).map(([k, v]) => `${k}:${risonEncode(v)}`).join(',')})`;
  }
  return String(value);
}

export function getO11yKibanaUrl() {
  return (import.meta.env.VITE_KIBANA_URL || O11Y_DEFAULT).replace(/\/$/, '');
}

export function getSecurityKibanaUrl() {
  return (import.meta.env.VITE_SECURITY_KIBANA_URL || SECURITY_DEFAULT).replace(/\/$/, '');
}

export function getO11yEsUrl() {
  return (import.meta.env.VITE_ES_URL || 'https://otel-demo-a5630c.es.us-east-1.aws.elastic.cloud').replace(/\/$/, '');
}

export function getSecurityEsUrl() {
  return (import.meta.env.VITE_SECURITY_ES_URL || 'https://my-security-project-ac9463.es.us-central1.gcp.elastic.cloud').replace(/\/$/, '');
}

export function kibanaHostLabel(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/^https?:\/\//, '');
  return base.split('.')[0] || base;
}

export function kibanaDiscoverUrl(kibanaBase, { query, timeFrom = TIME.from, timeTo = TIME.to } = {}) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  if (!base) return null;
  const esql = query || AETHER_DISCOVER_ESQL;
  const appState = {
    dataSource: { type: 'esql' },
    filters: [],
    interval: 'auto',
    query: { esql },
    sort: [],
  };
  const globalState = {
    filters: [],
    refreshInterval: { pause: true, value: 60000 },
    time: { from: timeFrom, to: timeTo },
  };
  return `${base}/app/discover#/?_g=${risonEncode(globalState)}&_a=${risonEncode(appState)}`;
}

export function kibanaDashboardsUrl(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  return `${base}/app/dashboards#/list?_g=(time:(from:now-24h,to:now))`;
}

export function kibanaStreamsUrl(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  return `${base}/app/streams`;
}

/** APM service inventory — populated after Seed live metrics (OTLP traces). */
export function kibanaObservabilityServicesUrl(kibanaBase, { serviceName } = {}) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  const params = new URLSearchParams({
    comparisonEnabled: 'true',
    environment: 'ENVIRONMENT_ALL',
    lagAhead: 'off',
    rangeFrom: 'now-24h',
    rangeTo: 'now',
  });
  if (serviceName) {
    params.set('kuery', `service.name : "${serviceName}"`);
  } else {
    params.set(
      'kuery',
      'service.name : "matchmaking" or service.name : "auth" or service.name : "session-gateway" or service.name : "store" or service.name : "aether-games-fleet"',
    );
  }
  return `${base}/app/apm/services?${params.toString()}`;
}

export function kibanaApmServiceUrl(kibanaBase, serviceName = 'matchmaking') {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  const params = new URLSearchParams({
    comparisonEnabled: 'true',
    environment: 'ENVIRONMENT_ALL',
    rangeFrom: 'now-24h',
    rangeTo: 'now',
  });
  return `${base}/app/apm/services/${encodeURIComponent(serviceName)}/overview?${params.toString()}`;
}

/**
 * Metrics deep link for the demo.
 * Metrics Explorer (`/app/metrics/explorer`) was removed on Observability Serverless (404).
 * Prefer Discover metrics exploration for Aether OTLP service metrics.
 * Host inventory (if needed): `${base}/app/metrics/hosts`
 */
export function kibanaMetricsUrl(kibanaBase) {
  return kibanaDiscoverUrl(kibanaBase, { query: AETHER_DISCOVER_ESQL });
}

/** @deprecated Use kibanaMetricsUrl — Metrics Explorer 404s on Serverless. */
export function kibanaMetricsExplorerUrl(kibanaBase) {
  return kibanaMetricsUrl(kibanaBase);
}

export function kibanaRulesUrl(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  return `${base}/app/observability/alerts/rules`;
}

export function kibanaSecurityUrl(section = 'alerts') {
  const base = getSecurityKibanaUrl();
  // Always pin Default space so seeded alerts (kibana.space_ids: default) are visible.
  // Custom spaces like "Security - psimkins" will not show those docs.
  const space = (import.meta.env.VITE_SECURITY_SPACE_ID || 'default').trim() || 'default';
  const prefix = `/s/${encodeURIComponent(space)}`;
  const paths = {
    alerts: '/app/security/alerts',
    cases: '/app/security/cases',
    rules: '/app/security/rules',
    overview: '/app/security/overview',
    entityAnalytics: '/app/security/explore/users',
    attackDiscovery: '/app/security/attack_discovery',
  };
  return `${base}${prefix}${paths[section] || paths.alerts}`;
}

export function getInstruqtInviteUrl() {
  return (
    import.meta.env.VITE_INSTRUQT_INVITE_URL ||
    'https://play.instruqt.com/elastic/invite/6fjbsdobn1wy'
  );
}
