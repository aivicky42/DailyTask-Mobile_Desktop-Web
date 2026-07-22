import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sun, Moon, Monitor, Bell, Calendar, Globe, Clock,
  Save, Volume2, Tag, RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getSettings, updateSettings, syncWithServer } from '../api/client';
import { useTheme } from '../hooks/useTheme';
import CategoryManager from '../components/CategoryManager';
import type { Settings, ThemeMode } from '../types';
import { getApiBaseUrl, getLastSyncAt, setApiBaseUrl, setSyncEnabled } from '../lib/appConfig';
import { getSyncAccountState, signInForSync, signOutSync, signUpForSync } from '../lib/syncAccount';

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon, children }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <span className="text-primary">{icon}</span>
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h2>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

// ── Row wrapper ───────────────────────────────────────────────────────────────
function Row({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ── Language options ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'pt', label: 'Português' },
  { value: 'ar', label: 'العربية' },
];

const TIMEZONES: string[] = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');

const SOUNDS = [
  { value: 'default', label: 'Default' },
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'soft', label: 'Soft' },
  { value: 'none', label: 'None' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [local, setLocal] = useState<Partial<Settings>>({});
  const [saved, setSaved] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState('');
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncForm, setShowSyncForm] = useState(false);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncAccountEmail, setSyncAccountEmail] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  // Sync local state when settings load
  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  useEffect(() => {
    (async () => {
      setApiBaseUrlState(await getApiBaseUrl());
      setLastSyncedAtState(await getLastSyncAt());
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email);
    })();
  }, []);

  const mutation = useMutation({
    mutationFn: () => updateSettings(local),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveServerUrl = async () => {
    await setApiBaseUrl(apiBaseUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await syncWithServer();
      setLastSyncedAtState(result.synced_at);
      await qc.invalidateQueries();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsAuthBusy(true);
    try {
      await signUpForSync(syncEmail.trim(), syncPassword);
      await setSyncEnabled(true);
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email ?? syncEmail.trim());
      setShowSyncForm(false);
      setSyncPassword('');
      await qc.invalidateQueries();
    } catch (error: any) {
      alert(error?.message ?? 'Could not create account.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthBusy(true);
    try {
      await signInForSync(syncEmail.trim(), syncPassword);
      await setSyncEnabled(true);
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email ?? syncEmail.trim());
      setShowSyncForm(false);
      setSyncPassword('');
      await qc.invalidateQueries();
    } catch (error: any) {
      alert(error?.message ?? 'Could not sign in.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleDisconnectSync = async () => {
    setIsAuthBusy(true);
    try {
      await signOutSync();
      await setSyncEnabled(false);
      setSyncAccountEmail(null);
      setSyncEmail('');
      setSyncPassword('');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const selectCls =
    'px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors appearance-none cursor-pointer';

  const inputCls =
    'w-24 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors text-center';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Manage your preferences
          </p>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
            saved
              ? 'bg-green-500 text-white'
              : 'bg-primary text-white hover:bg-primary-600 disabled:opacity-60',
          )}
        >
          <Save size={15} />
          {mutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* ── Appearance ────────────────────────────────────────────────── */}
      <Section title="Appearance" icon={<Monitor size={16} />}>
        <Row label="Theme" description="Choose your preferred colour scheme">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            {(
              [
                { value: 'light' as ThemeMode, icon: <Sun size={15} />, label: 'Light' },
                { value: 'system' as ThemeMode, icon: <Monitor size={15} />, label: 'System' },
                { value: 'dark' as ThemeMode, icon: <Moon size={15} />, label: 'Dark' },
              ] as const
            ).map(({ value, icon, label }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  update('theme', value);
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  (local.theme ?? theme) === value
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
                title={label}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── Notifications ─────────────────────────────────────────────── */}
      <Section title="Notifications" icon={<Bell size={16} />}>
        <Row
          label="Default Reminder"
          description="Minutes before a task starts"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              value={local.default_reminder ?? ''}
              onChange={(e) => update('default_reminder', parseInt(e.target.value) || 0)}
              className={inputCls}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
          </div>
        </Row>

        <Row label="Notification Sound" description="Sound played for reminders">
          <select
            value={local.notification_sound ?? ''}
            onChange={(e) => update('notification_sound', e.target.value)}
            className={selectCls}
          >
            {SOUNDS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* ── Time & Calendar ───────────────────────────────────────────── */}
      <Section title="Time & Calendar" icon={<Calendar size={16} />}>
        <Row label="Week Starts On" description="First day of the week in calendar">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
            {(['Sunday', 'Monday'] as const).map((day) => (
              <button
                key={day}
                onClick={() => update('week_start', day)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  (local.week_start ?? settings?.week_start) === day
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </Row>

        <Row
          label="Default Task Duration"
          description="Default time allocation for new tasks"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={local.default_duration ?? ''}
              onChange={(e) => update('default_duration', parseInt(e.target.value) || 60)}
              className={inputCls}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">min</span>
          </div>
        </Row>

        <Row label="Timezone" description="Your local timezone">
          <select
            value={local.timezone ?? ''}
            onChange={(e) => update('timezone', e.target.value)}
            className={cn(selectCls, 'max-w-[200px]')}
          >
            {TIMEZONES.map((tz: string) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* ── Language ──────────────────────────────────────────────────── */}
      <Section title="Language" icon={<Globe size={16} />}>
        <Row label="Display Language" description="Interface language">
          <select
            value={local.language ?? ''}
            onChange={(e) => update('language', e.target.value)}
            className={selectCls}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </Row>
      </Section>

      {/* ── Sync & Server ─────────────────────────────────────────────── */}
      <Section title="Sync & Server" icon={<RefreshCw size={16} />}>
        <Row label="Sync Account" description="Create or use the same Supabase account on any device">
          {syncAccountEmail ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">{syncAccountEmail}</span>
              <button
                onClick={handleDisconnectSync}
                disabled={isAuthBusy}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSyncForm((prev) => !prev)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-600 transition-colors"
            >
              Enable Sync
            </button>
          )}
        </Row>

        {showSyncForm && !syncAccountEmail && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Sign up or sign in with the same email on another device to keep both in sync.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={syncEmail}
                onChange={(e) => setSyncEmail(e.target.value)}
                type="email"
                placeholder="Email address"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <input
                value={syncPassword}
                onChange={(e) => setSyncPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCreateAccount}
                disabled={isAuthBusy}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-60 transition-colors"
              >
                {isAuthBusy ? 'Working…' : 'Create Supabase Account'}
              </button>
              <button
                onClick={handleSignIn}
                disabled={isAuthBusy}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 transition-colors"
              >
                {isAuthBusy ? 'Working…' : 'Sign In'}
              </button>
            </div>
          </div>
        )}

        <Row label="Backend URL" description="Point this browser to your API server">
          <div className="flex items-center gap-2">
            <input
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrlState(e.target.value)}
              placeholder="/api/v1 or http://localhost:3000/api/v1"
              className="w-80 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <button
              onClick={handleSaveServerUrl}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Save URL
            </button>
          </div>
        </Row>

        <Row label="Manual Sync" description={`Last synced: ${lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}`}>
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </Row>
      </Section>

      {/* ── Categories ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <span className="text-primary"><Tag size={16} /></span>
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Categories</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            Organise tasks with custom categories. System categories cannot be deleted.
          </p>
          <CategoryManager />
        </div>
      </div>
    </div>
  );
}
