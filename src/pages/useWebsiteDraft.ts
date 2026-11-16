import { useEffect, useReducer, useState } from 'react';
import type { SchoolWebsiteContent as Site } from '../data';

type History = { past: Site[]; current: Site; future: Site[]; base: string; dirty: boolean };
type Action =
  | { type: 'edit'; apply: (site: Site) => Site }
  | { type: 'reset' | 'sync'; site: Site; base: string }
  | { type: 'undo' | 'redo' };
function fresh(current: Site, base: string): History {
  return { past: [], current, future: [], base, dirty: false };
}
function reduce(history: History, action: Action): History {
  switch (action.type) {
    case 'reset':
      return fresh(action.site, action.base);
    case 'sync':
      return !history.dirty && history.base !== action.base
        ? fresh(action.site, action.base)
        : history;
    case 'edit': {
      const current = action.apply(history.current);
      if (current === history.current) return history;
      return {
        ...history,
        past: [...history.past.slice(-59), history.current],
        current,
        future: [],
        dirty: true,
      };
    }
    case 'undo': {
      const previous = history.past.at(-1);
      return previous
        ? {
            ...history,
            past: history.past.slice(0, -1),
            current: previous,
            future: [history.current, ...history.future],
            dirty: true,
          }
        : history;
    }
    case 'redo': {
      const [next, ...rest] = history.future;
      return next
        ? {
            ...history,
            past: [...history.past, history.current],
            current: next,
            future: rest,
            dirty: true,
          }
        : history;
    }
  }
}

export function useWebsiteDraft(owner: string, published: Site, version: string) {
  const key = 'aos-website-draft-v1:' + owner;
  const [problem, setProblem] = useState('');
  const [history, dispatch] = useReducer(reduce, undefined, () => {
    const initial = fresh(published, version);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const saved = JSON.parse(raw);
      if (
        typeof saved.base === 'string' &&
        saved.site?.pages?.home &&
        Array.isArray(saved.site.navigation)
      )
        return { ...initial, current: saved.site as Site, base: saved.base, dirty: true };
    } catch {
      /* The published site remains available if browser storage is unavailable. */
    }
    return initial;
  });
  useEffect(() => {
    dispatch({ type: 'sync', site: published, base: version });
  }, [published, version]);
  useEffect(() => {
    try {
      if (history.dirty)
        localStorage.setItem(key, JSON.stringify({ base: history.base, site: history.current }));
      else localStorage.removeItem(key);
      setProblem('');
    } catch {
      setProblem('Browser storage is unavailable. Keep this editor open until you publish.');
    }
  }, [key, history.base, history.current, history.dirty]);
  return { history, dispatch, problem };
}
