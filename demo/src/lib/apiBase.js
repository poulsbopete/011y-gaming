/** API origin for Vercel routes. On Atrium (static HTML) point at the live Vercel deploy. */
const VERCEL = 'https://011y-gaming.vercel.app';

export function apiOrigin() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('vercel.app')) return '';
  return VERCEL;
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiOrigin()}${p}`;
}

/** Static asset on the live deploy (Atrium has no /public files). */
export function staticUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const origin = apiOrigin();
  return origin ? `${origin}${p}` : p;
}
