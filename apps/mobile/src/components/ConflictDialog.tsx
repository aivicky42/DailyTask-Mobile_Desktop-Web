import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { ConflictCheck } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { formatTimeDisplay } from '../lib/utils';

interface Props {
  visible: boolean;
  conflict: ConflictCheck | null;
  onReschedule: () => void;
  onOverride: () => void;
}

export default function ConflictDialog({ visible, conflict, onReschedule, onOverride }: Props) {
  const theme = useAppTheme();

  if (!conflict) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onReschedule}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialog, { backgroundColor: theme.surface }]}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: COLORS.warning + '20' }]}>
                <Text style={styles.icon}>⚠️</Text>
              </View>

              <Text style={[styles.title, { color: theme.text }]}>Time Conflict Detected</Text>

              <Text style={[styles.message, { color: theme.textSecondary }]}>
                This task overlaps with{' '}
                {conflict.conflicting_tasks.length === 1 ? 'another task' : `${conflict.conflicting_tasks.length} other tasks`}:
              </Text>

              {/* Conflicting tasks */}
              <View style={[styles.conflictList, { borderColor: theme.border }]}>
                {conflict.conflicting_tasks.map((ct) => (
                  <View
                    key={ct.id}
                    style={[styles.conflictItem, { borderBottomColor: theme.border }]}
                  >
                    <Text style={[styles.conflictTitle, { color: theme.text }]} numberOfLines={1}>
                      {ct.title}
                    </Text>
                    <Text style={[styles.conflictTime, { color: theme.textSecondary }]}>
                      {formatTimeDisplay(ct.start_time)} – {formatTimeDisplay(ct.end_time)}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.subMessage, { color: theme.textMuted }]}>
                You can reschedule your task or override the conflict.
              </Text>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.rescheduleBtn, { borderColor: theme.border }]}
                  onPress={onReschedule}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.rescheduleBtnText, { color: theme.text }]}>
                    Reschedule
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.overrideBtn, { backgroundColor: COLORS.warning }]}
                  onPress={onOverride}
                  activeOpacity={0.8}
                >
                  <Text style={styles.overrideBtnText}>Override</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  conflictList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  conflictItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  conflictTime: {
    fontSize: 12,
  },
  subMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleBtn: {
    borderWidth: 1.5,
  },
  rescheduleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  overrideBtn: {},
  overrideBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
