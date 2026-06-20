import { useEffect } from 'react';

export const useKeyboardShortcut = (
  keys,
  callback,
  options = {}
) => {
  useEffect(() => {
    const handler = (e) => {
      const key = e.key.toLowerCase();
      const matchKey = keys.some((k) => k.toLowerCase() === key);
      if (!matchKey) return;

      const metaMatch = options.metaKey ? e.metaKey || e.ctrlKey : true;
      const ctrlMatch = options.ctrlKey ? e.ctrlKey : true;

      if (metaMatch && ctrlMatch) {
        if (options.preventDefault) e.preventDefault();
        callback(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [keys, callback, options.metaKey, options.ctrlKey, options.preventDefault]);
};

export const usePlatform = () => {
  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  return { isMac, modKey: isMac ? '\u2318' : 'Ctrl' };
};

export const formatRelativeTime = (date) => {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
