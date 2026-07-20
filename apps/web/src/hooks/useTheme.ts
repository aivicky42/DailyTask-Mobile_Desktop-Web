import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '../api/client';
import type { ThemeMode } from '../types';

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    return;
  }
  if (theme === 'light') {
    root.classList.remove('dark');
    return;
  }
  // system
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) root.classList.add('dark');
  else root.classList.remove('dark');
}

export function useTheme() {
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 60_000,
  });

  const theme: ThemeMode = settings?.theme ?? 'system';

  useEffect(() => {
    applyTheme(theme);

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const { mutate } = useMutation({
    mutationFn: (t: ThemeMode) => updateSettings({ theme: t }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  return { theme, setTheme: mutate };
}
