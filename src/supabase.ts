import { createClient } from '@supabase/supabase-js';
import project from './supabase-project.json';

const url = import.meta.env.VITE_SUPABASE_URL || project.url;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || project.publishableKey;

export const authStorageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
export const offlineAccessDisabledKey = `${authStorageKey}-offline-disabled`;
/** Identify an existing local session only; all server access is still reauthorized. */
export function retainedAccountId(): string | undefined {
  try {
    if (localStorage.getItem(offlineAccessDisabledKey)) return undefined;
    const session = JSON.parse(localStorage.getItem(authStorageKey) || 'null');
    return session?.access_token && session?.refresh_token && typeof session?.user?.id === 'string'
      ? session.user.id
      : undefined;
  } catch {
    return undefined;
  }
}

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { storageKey: authStorageKey },
      global: {
        fetch: (input, init) => {
          if (typeof navigator !== 'undefined' && navigator.onLine === false)
            return Promise.reject(new TypeError('Network is offline'));
          const target =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          // Bound auth requests so token refresh cannot indefinitely block opening
          // the retained workspace when Wi-Fi has no working internet connection.
          if (new URL(target).pathname.startsWith('/auth/v1/')) {
            const timeout = AbortSignal.timeout(8000);
            return fetch(input, {
              ...init,
              signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
            });
          }
          return fetch(input, init);
        },
      },
    })
  : null;
