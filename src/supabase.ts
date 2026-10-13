import { createClient } from '@supabase/supabase-js';
import project from './supabase-project.json';

const url = import.meta.env.VITE_SUPABASE_URL || project.url;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || project.publishableKey;

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      global: {
        fetch: (input, init) => {
          const target =
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          // auth-js clears the local session even when logout fails. Bound this one
          // request so an unreachable auth service cannot leave the user trapped.
          if (new URL(target).pathname.endsWith('/auth/v1/logout')) {
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
