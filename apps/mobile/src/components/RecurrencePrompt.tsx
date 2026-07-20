import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DeleteScope } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { toDateString, formatDate } from '../lib/utils';

interface Props {
  visible: boolean;
  mode: 'edit' | 'delete';
  onSelect: (scope: DeleteScope, endDate?: string) => void;
  onCancel: () => void;
}

export default function RecurrencePrompt({ visible, mode, onSelect, onCancel }: Props) {
  const theme = useAppTheme();
  const [selected, setSelected] = useState<DeleteScope | null>(null);
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSelect = (scope: DeleteScope) => {
    if (scope === 'RANGE') {
      setSelected(scope);
    } else {
      onSelect(scope);
      setSelected(null);
    }
  };

  const handleConfirmRange = () => {
    onSelect('RANGE', toDateString(endDate));
    setSelected(null);
  };

  const options: { scope: DeleteScope; label: string; subtitle: string; icon: string }[] = [
    {
      scope: 'SINGLE',
      label: 'Current Day Only',
      subtitle: mode === 'edit' ? 'Edit only this occurrence' : 'Remove only this occurrence',
      icon: '📅',
    },
    {
      scope: 'RANGE',
      label: 'Day Range',
      subtitle: mode === 'edit' ? 'Edit occurrences up to a date' : 'Remove occurrences up to a date',
      icon: '📆',
    },
    {
      scope: 'ALL_RECURRING',
      label: 'All Recurring',
      subtitle: mode === 'edit' ? 'Edit all occurrences' : 'Remove all occurrences',
      icon: '🔄',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
              {/* Handle */}
              <View style={[styles.handle, { backgroundColor: theme.border }]} />

              <Text style={[styles.title, { color: theme.text }]}>
                {mode === 'edit' ? 'Edit Recurring Task' : 'Delete Recurring Task'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                How many occurrences would you like to {mode}?
              </Text>

              {/* Options */}
              <View style={styles.options}>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.scope}
                    style={[
                      styles.option,
                      { borderColor: theme.border },
                      selected === opt.scope && {
                        borderColor: COLORS.primary,
                        backgroundColor: COLORS.primary + '10',
                      },
                    ]}
                    onPress={() => handleSelect(opt.scope)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, { color: theme.text }]}>{opt.label}</Text>
                      <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                        {opt.subtitle}
                      </Text>
                    </View>
                    {selected === opt.scope && (
                      <View style={[styles.check, { backgroundColor: COLORS.primary }]}>
                        <Text style={styles.checkMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date range picker (if RANGE selected) */}
              {selected === 'RANGE' && (
                <View style={[styles.rangeSection, { borderColor: theme.border }]}>
                  <Text style={[styles.rangeLabel, { color: theme.textSecondary }]}>End Date</Text>
                  <TouchableOpacity
                    style={[styles.dateBtn, { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight }]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateBtnText, { color: COLORS.primary }]}>
                      {formatDate(toDateString(endDate))}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      minimumDate={new Date()}
                      onChange={(_, date) => {
                        setShowDatePicker(false);
                        if (date) setEndDate(date);
                      }}
                    />
                  )}

                  <TouchableOpacity
                    style={[styles.confirmBtn, { backgroundColor: COLORS.primary }]}
                    onPress={handleConfirmRange}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>Confirm Range</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Cancel */}
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.border }]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
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
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  options: {
    gap: 10,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  optionIcon: {
    fontSize: 22,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rangeSection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  rangeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  dateBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
