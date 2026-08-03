const O11Y_DEFAULT = 'https://otel-demo-a5630c.kb.us-east-1.aws.elastic.cloud';
const SECURITY_DEFAULT = 'https://my-security-project-ac9463.kb.us-central1.gcp.elastic.cloud';
const TIME = { from: 'now-24h', to: 'now' };

export const AETHER_DISCOVER_ESQL = [
  'FROM metrics-*',
  '| WHERE service.name IS NOT NULL',
  '| STATS metric_points = COUNT(*) BY service.name',
  '| SORT metric_points DESC',
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

export function kibanaObservabilityServicesUrl(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  return `${base}/app/apm/services?rangeFrom=now-24h&rangeTo=now`;
}

export function kibanaRulesUrl(kibanaBase) {
  const base = (kibanaBase || getO11yKibanaUrl()).replace(/\/$/, '');
  return `${base}/app/observability/alerts/rules`;
}

export function kibanaSecurityUrl(section = 'alerts') {
  const base = getSecurityKibanaUrl();
  const paths = {
    alerts: '/app/security/alerts',
    cases: '/app/security/cases',
    rules: '/app/security/rules',
    overview: '/app/security/overview',
    entityAnalytics: '/app/security/explore/users',
    attackDiscovery: '/app/security/attack_discovery',
  };
  return `${base}${paths[section] || paths.alerts}`;
}

export function getInstruqtInviteUrl() {
  return import.meta.env.VITE_INSTRUQT_INVITE_URL || '';
}
