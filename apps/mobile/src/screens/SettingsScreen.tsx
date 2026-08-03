import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSettings, updateSettings, getCategories, syncWithServer } from '../api/client';
import { Settings, ThemeMode } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import CategoryManager from '../components/CategoryManager';
import { getApiBaseUrl, getLastSyncAt, setApiBaseUrl, setSyncEnabled } from '../lib/appConfig';
import { getSyncAccountState, signInForSync, signOutSync, signUpForSync } from '../lib/syncAccount';

type WeekStart = 'SUN' | 'MON';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '⚙️' },
];

const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: 'SUN', label: 'Sunday' },
  { value: 'MON', label: 'Monday' },
];

export default function SettingsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [localSettings, setLocalSettings] = useState<Partial<Settings>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [apiBaseUrl, setApiBaseUrlState] = useState('');
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncAccountEmail, setSyncAccountEmail] = useState<string | null>(null);
  const [showSyncForm, setShowSyncForm] = useState(false);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // ── Sync local state from server ────────────────────────────────────────────

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        theme: settings.theme,
        default_reminder: settings.default_reminder,
        week_start: settings.week_start,
        default_duration: settings.default_duration,
        notification_sound: settings.notification_sound,
      });
      setIsDirty(false);
    }
  }, [settings]);

  useEffect(() => {
    (async () => {
      setApiBaseUrlState(await getApiBaseUrl());
      setLastSyncedAtState(await getLastSyncAt());
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email);
    })();
  }, []);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Settings>) => updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setIsDirty(false);
      Alert.alert('Saved', 'Settings updated successfully.');
    },
    onError: () => Alert.alert('Error', 'Failed to save settings.'),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const update = useCallback((key: keyof Settings, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    updateMutation.mutate(localSettings);
  }, [localSettings, updateMutation]);

  const handleSaveServerUrl = useCallback(async () => {
    await setApiBaseUrl(apiBaseUrl);
    Alert.alert('Saved', 'Server URL updated for this device.');
  }, [apiBaseUrl]);

  const handleSyncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await syncWithServer();
      setLastSyncedAtState(result.synced_at);
      await queryClient.invalidateQueries();
      Alert.alert('Synced', 'Data refreshed from the server.');
    } catch (error: any) {
      Alert.alert('Sync failed', error?.message ?? 'Could not sync with the server.');
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  const handleCreateAccount = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signUpForSync(syncEmail.trim(), syncPassword);
      await setSyncEnabled(true);
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email ?? syncEmail.trim());
      setShowSyncForm(false);
      setSyncPassword('');
      Alert.alert('Sync enabled', 'Your account is ready on this device.');
    } catch (error: any) {
      Alert.alert('Sign up failed', error?.message ?? 'Could not create account.');
    } finally {
      setIsAuthBusy(false);
    }
  }, [syncEmail, syncPassword]);

  const handleSignIn = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signInForSync(syncEmail.trim(), syncPassword);
      await setSyncEnabled(true);
      const syncState = await getSyncAccountState();
      setSyncAccountEmail(syncState.email ?? syncEmail.trim());
      setShowSyncForm(false);
      setSyncPassword('');
      Alert.alert('Signed in', 'This device is connected to your Supabase account.');
    } catch (error: any) {
      Alert.alert('Sign in failed', error?.message ?? 'Could not sign in.');
    } finally {
      setIsAuthBusy(false);
    }
  }, [syncEmail, syncPassword]);

  const handleDisconnectSync = useCallback(async () => {
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
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (settingsLoading) {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page Header ─────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Settings</Text>
          {isDirty && (
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: COLORS.primary, opacity: updateMutation.isPending ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={updateMutation.isPending}
              activeOpacity={0.8}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Appearance ──────────────────────────────────────────────── */}
        <Section title="Appearance" icon="🎨">
          <View style={[styles.settingRow, { borderColor: theme.border }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Theme</Text>
              <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                Choose your preferred appearance
              </Text>
            </View>
          </View>
          <View style={styles.segmentedControl}>
            {THEME_OPTIONS.map((opt) => {
              const isActive = localSettings.theme === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.segment,
                    { borderColor: theme.border, backgroundColor: theme.surface },
                    isActive && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                  ]}
                  onPress={() => update('theme', opt.value)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.segmentIcon}>{opt.icon}</Text>
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: isActive ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* ── Defaults ────────────────────────────────────────────────── */}
        <Section title="Defaults" icon="⚙️">
          {/* Week start */}
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Week Starts On</Text>
            <View style={styles.toggleRow}>
              {WEEK_START_OPTIONS.map((opt) => {
                const isActive = localSettings.week_start === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.toggleOption,
                      { borderColor: isActive ? COLORS.primary : theme.border },
                      isActive && { backgroundColor: COLORS.primaryLight },
                    ]}
                    onPress={() => update('week_start', opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.toggleOptionText,
                        { color: isActive ? COLORS.primary : theme.textSecondary },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Default reminder */}
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Default Reminder</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Minutes before task starts
                </Text>
              </View>
              <View style={[styles.numberInput, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <TouchableOpacity
                  onPress={() =>
                    update('default_reminder', Math.max(0, (localSettings.default_reminder ?? 15) - 5))
                  }
                  style={styles.numberBtn}
                >
                  <Text style={[styles.numberBtnText, { color: theme.text }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.numberValue, { color: theme.text }]}>
                  {localSettings.default_reminder ?? 15}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    update('default_reminder', Math.min(120, (localSettings.default_reminder ?? 15) + 5))
                  }
                  style={styles.numberBtn}
                >
                  <Text style={[styles.numberBtnText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Default duration */}
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Default Duration</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Minutes for new tasks
                </Text>
              </View>
              <View style={[styles.numberInput, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <TouchableOpacity
                  onPress={() =>
                    update('default_duration', Math.max(5, (localSettings.default_duration ?? 30) - 5))
                  }
                  style={styles.numberBtn}
                >
                  <Text style={[styles.numberBtnText, { color: theme.text }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.numberValue, { color: theme.text }]}>
                  {localSettings.default_duration ?? 30}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    update('default_duration', Math.min(480, (localSettings.default_duration ?? 30) + 5))
                  }
                  style={styles.numberBtn}
                >
                  <Text style={[styles.numberBtnText, { color: theme.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Section>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Section title="Notifications" icon="🔔">
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Notification Sound</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  {localSettings.notification_sound ?? 'default'}
                </Text>
              </View>
              <View style={[styles.soundBadge, { backgroundColor: COLORS.primaryLight }]}>
                <Text style={[styles.soundBadgeText, { color: COLORS.primary }]}>
                  🔊 {localSettings.notification_sound ?? 'Default'}
                </Text>
              </View>
            </View>
          </View>
        </Section>

        {/* ── Sync & Server ──────────────────────────────────────────── */}
        <Section title="Sync & Server" icon="☁️">
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Backend URL</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Point this device at your API server
                </Text>
              </View>
            </View>
            <TextInput
              value={apiBaseUrl}
              onChangeText={setApiBaseUrlState}
              placeholder="http://192.168.1.10:3000/api/v1"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.urlInput, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
            />
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
              onPress={handleSaveServerUrl}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Save URL</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Manual Sync</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Pull the latest data from the server
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: COLORS.primary, opacity: isSyncing ? 0.7 : 1 }]}
                onPress={handleSyncNow}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                {isSyncing ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
              Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}
            </Text>
          </View>
        </Section>

        {/* ── Sync & Account ─────────────────────────────────────────── */}
        <Section title="Sync & Account" icon="☁️">
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.settingCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Sync Account</Text>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Optional: only needed to share data between phone and web. Single-device use stays local.
                </Text>
              </View>
              {syncAccountEmail ? (
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.border }]}
                  onPress={handleDisconnectSync}
                  disabled={isAuthBusy}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary }]}
                  onPress={() => setShowSyncForm((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>Enable Sync</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
              {syncAccountEmail ? `Connected as ${syncAccountEmail}` : 'Create or sign in with an email account.'}
            </Text>

            {showSyncForm && !syncAccountEmail && (
              <View style={styles.syncForm}>
                <Text style={[styles.settingSubtitle, { color: theme.textMuted }]}>
                  Sign up once, then use the same email on another device to sync everything.
                </Text>
                <TextInput
                  value={syncEmail}
                  onChangeText={setSyncEmail}
                  placeholder="Email address"
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={[styles.syncInput, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
                />
                <TextInput
                  value={syncPassword}
                  onChangeText={setSyncPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={[styles.syncInput, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
                />
                <View style={styles.syncButtonsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { borderColor: theme.border, flex: 1 }]}
                    onPress={handleSignIn}
                    disabled={isAuthBusy}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                      {isAuthBusy ? 'Working…' : 'Sign In'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary, flex: 1 }]}
                    onPress={handleCreateAccount}
                    disabled={isAuthBusy}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveBtnText}>
                      {isAuthBusy ? 'Working…' : 'Create Account'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </Section>

        {/* ── Categories ──────────────────────────────────────────────── */}
        <Section title="Categories" icon="🏷️">
          <CategoryManager categories={categories} />
        </Section>

        {/* ── About ───────────────────────────────────────────────────── */}
        <Section title="About" icon="ℹ️">
          <View style={[styles.settingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.aboutRow}>
              <View style={[styles.appIcon, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.appIconText}>DT</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.appName, { color: theme.text }]}>DailyTask</Text>
                <Text style={[styles.appVersion, { color: theme.textMuted }]}>Version 1.0.0</Text>
              </View>
            </View>
            <Text style={[styles.appDesc, { color: theme.textSecondary }]}>
              A beautiful and productive task management app to help you stay on top of your daily goals.
            </Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: 16,
    gap: 24,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  section: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionContent: { gap: 10 },
  segmentedControl: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  segmentIcon: { fontSize: 16 },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  settingRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  settingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingInfo: { gap: 3 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingSubtitle: { fontSize: 12, marginTop: 1 },
  urlInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  syncForm: { gap: 10, marginTop: 8 },
  syncInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  syncButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
  },
  toggleOptionText: { fontSize: 14, fontWeight: '600' },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  numberBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBtnText: { fontSize: 18, fontWeight: '500' },
  numberValue: {
    width: 40,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
  soundBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  soundBadgeText: { fontSize: 13, fontWeight: '600' },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  appName: { fontSize: 17, fontWeight: '700' },
  appVersion: { fontSize: 12, marginTop: 2 },
  appDesc: { fontSize: 13, lineHeight: 19 },
});
