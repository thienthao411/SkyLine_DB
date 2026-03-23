export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function getApiOrigin(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const runtimeConfig = (window as Window & { __SKYLINE_API_ORIGIN__?: string }).__SKYLINE_API_ORIGIN__;
  const normalizedRuntimeConfig = String(runtimeConfig || '').trim().replace(/\/+$/, '');

  if (normalizedRuntimeConfig) {
    return normalizedRuntimeConfig;
  }

  return window.location.origin.replace(/\/+$/, '');
}

export function rewriteApiUrlIfNeeded(url: string): string {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl.startsWith('http://localhost:5000') && !normalizedUrl.startsWith('https://localhost:5000')) {
    return url;
  }

  if (isLocalDevHost()) {
    return url;
  }

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) {
    return url;
  }

  return normalizedUrl
    .replace('http://localhost:5000', apiOrigin)
    .replace('https://localhost:5000', apiOrigin);
}

export function getRealtimeServerUrl(): string {
  if (isLocalDevHost()) {
    return 'http://localhost:5000';
  }

  return getApiOrigin();
}
