import { useSyncExternalStore } from 'react';

export type OfflineAppStatus = 'preparing' | 'ready' | 'unavailable';
export interface OfflineAppState {
  status: OfflineAppStatus;
  updateAvailable: boolean;
}
let state: OfflineAppState = { status: 'preparing', updateAvailable: false };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let started = false;
function publish(next: OfflineAppState) {
  if (next.status === state.status && next.updateAvailable === state.updateAvailable) return;
  state = next;
  listeners.forEach((listener) => listener());
}
export function useOfflineApp(): OfflineAppState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
async function inspect() {
  const worker = navigator.serviceWorker.controller || registration?.active;
  if (!worker) return;
  const ready = await new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 15000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data?.ready === true);
    };
    worker.postMessage({ type: 'AOS_OFFLINE_STATUS' }, [channel.port2]);
  });
  publish({
    status: ready ? 'ready' : 'unavailable',
    updateAvailable: Boolean(registration?.waiting),
  });
}
/** Production only: development scripts are not a reliable offline application. */
export function registerOfflineApp() {
  if (started) return;
  started = true;
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) {
    publish({ status: 'unavailable', updateAvailable: false });
    return;
  }
  const check = () =>
    void inspect().catch(() => {
      publish({ status: 'unavailable', updateAvailable: Boolean(registration?.waiting) });
    });
  navigator.serviceWorker.addEventListener('controllerchange', check);
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register('./service-worker.js', {
        scope: './',
        updateViaCache: 'none',
      });
      const observe = () => {
        const installing = registration?.installing;
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' || installing.state === 'activated') check();
          if (installing.state === 'redundant' && !registration?.active)
            publish({ status: 'unavailable', updateAvailable: false });
        });
      };
      registration.addEventListener('updatefound', observe);
      observe();
      check();
    } catch {
      // A registered worker can still serve cached code when update discovery is offline.
      if (navigator.serviceWorker.controller) check();
      else publish({ status: 'unavailable', updateAvailable: false });
    }
  };
  window.addEventListener('online', () => {
    if (!registration) void register();
    else {
      void registration.update().catch(() => {});
      check();
    }
  });
  window.addEventListener('focus', check);
  void register();
}
