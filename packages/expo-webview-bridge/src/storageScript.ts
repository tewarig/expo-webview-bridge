import type { CookieConfig, WebStorageConfig } from './types';

function buildCookieString(cookie: CookieConfig): string {
  let str = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
  if (cookie.path !== undefined) str += `; path=${cookie.path}`;
  else str += `; path=/`;
  if (cookie.domain)  str += `; domain=${cookie.domain}`;
  if (cookie.expires) str += `; expires=${cookie.expires}`;
  if (cookie.maxAge !== undefined) str += `; max-age=${cookie.maxAge}`;
  if (cookie.sameSite) str += `; SameSite=${cookie.sameSite}`;
  if (cookie.secure)  str += `; Secure`;
  return str;
}

export function buildStorageScript(config: WebStorageConfig): string {
  const lines: string[] = ['(function () {'];

  if (config.cookies?.length) {
    for (const cookie of config.cookies) {
      lines.push(`  document.cookie = ${JSON.stringify(buildCookieString(cookie))};`);
    }
  }

  if (config.localStorage && Object.keys(config.localStorage).length > 0) {
    lines.push('  try {');
    for (const [key, value] of Object.entries(config.localStorage)) {
      lines.push(`    localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`);
    }
    lines.push('  } catch (e) { console.warn("[Bridge] localStorage error", e); }');
  }

  if (config.sessionStorage && Object.keys(config.sessionStorage).length > 0) {
    lines.push('  try {');
    for (const [key, value] of Object.entries(config.sessionStorage)) {
      lines.push(`    sessionStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`);
    }
    lines.push('  } catch (e) { console.warn("[Bridge] sessionStorage error", e); }');
  }

  lines.push('})();');
  return lines.join('\n');
}

export function appendQueryParams(
  uri: string,
  params: Record<string, string>,
): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  if (!qs) return uri;
  return uri.includes('?') ? `${uri}&${qs}` : `${uri}?${qs}`;
}
