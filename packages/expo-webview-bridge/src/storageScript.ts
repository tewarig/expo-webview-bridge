import type { CookieConfig, WebStorageConfig } from './types';

function buildCookieString(cookie: CookieConfig): string {
  let str = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
  str += `; path=${cookie.path ?? '/'}`;
  if (cookie.domain)           str += `; domain=${cookie.domain}`;
  if (cookie.expires)          str += `; expires=${cookie.expires}`;
  if (cookie.maxAge !== undefined) str += `; max-age=${cookie.maxAge}`;
  if (cookie.sameSite)         str += `; SameSite=${cookie.sameSite}`;
  if (cookie.secure)           str += `; Secure`;
  return str;
}

/**
 * Returns a self-contained JS string (ends with `true;`) that writes cookies,
 * localStorage, and sessionStorage. Each section is wrapped in its own try/catch
 * so a failure in one does not affect the others.
 */
export function buildStorageScript(config: WebStorageConfig): string {
  const lines: string[] = ['(function () {'];

  if (config.cookies?.length) {
    lines.push('  try {');
    for (const cookie of config.cookies) {
      lines.push(`    document.cookie = ${JSON.stringify(buildCookieString(cookie))};`);
    }
    lines.push('  } catch (e) { console.warn("[Bridge] cookie error", e); }');
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
  lines.push('true;');
  return lines.join('\n');
}
