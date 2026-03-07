import { useEffect, useState } from 'react';

export interface ProctoringSettings {
  tensorflow: boolean;
  objectDetection: boolean;
  tfIntervalMs: number;
  noFaceStrikeSec: number;
}

const DEFAULT_SETTINGS: ProctoringSettings = {
  tensorflow: true,
  objectDetection: true,
  tfIntervalMs: 1500,
  noFaceStrikeSec: 7,
};

/**
 * Fetches proctoring settings from the server once on mount.
 * Falls back to sensible defaults if the fetch fails.
 */
export function useProctoringSettings() {
  const [settings, setSettings] = useState<ProctoringSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/settings/proctoring')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setSettings({ ...DEFAULT_SETTINGS, ...data });
      })
      .catch(() => {
        // Use defaults silently
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { settings, loading };
}
