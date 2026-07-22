import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Category } from '../types';
import { COLORS } from '../constants/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { createCategory, updateCategory, deleteCategory } from '../api/client';

interface Props {
  categories: Category[];
}

interface CategoryForm {
  name: string;
  color_hex: string;
  icon_path: string;
}

const EMPTY_FORM: CategoryForm = {
  name: '',
  color_hex: COLORS.primary,
  icon_path: '📁',
};

const EMOJI_ICONS = [
  '📁', '💼', '🏠', '🎓', '❤️', '💪', '🎯', '🎨', '🎵', '🌿',
  '🍎', '✈️', '💰', '🔧', '📚', '🎮', '🌟', '🏋️', '🧘', '🎭',
];

export default function CategoryManager({ categories }: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['categories'] });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (error: Error) => Alert.alert('Error', error?.message ?? 'Failed to create category.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CategoryForm> }) =>
      updateCategory(id, data),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (error: Error) => Alert.alert('Error', error?.message ?? 'Failed to update category.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
    onError: (error: Error) => Alert.alert('Error', error?.message ?? 'Failed to delete category.'),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, color_hex: cat.color_hex, icon_path: cat.icon_path });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      Alert.alert('Validation', 'Category name is required.');
      return;
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (cat: Category) => {
    Alert.alert('Delete Category', `Delete "${cat.name}"? Tasks in this category won't be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(cat.id),
      },
    ]);
  };

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      setForm((prev) => ({ ...prev, icon_path: result.assets[0]!.uri }));
    }
  }, []);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  const systemCats = categories.filter((c) => c.is_system);
  const customCats = categories.filter((c) => !c.is_system);

  return (
    <View style={styles.container}>
      {/* System categories (view only) */}
      {systemCats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            System Categories
          </Text>
          {systemCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              theme={theme}
              isSystem
              onEdit={() => {}}
              onDelete={() => {}}
              isDeleting={false}
            />
          ))}
        </View>
      )}

      {/* Custom categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            My Categories
          </Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: COLORS.primary }]}
            onPress={openAdd}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {customCats.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border }]}>
            <Text style={styles.emptyIcon}>🏷️</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No custom categories yet
            </Text>
          </View>
        ) : (
          customCats.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              theme={theme}
              isSystem={false}
              onEdit={() => openEdit(cat)}
              onDelete={() => handleDelete(cat)}
              isDeleting={deleteMutation.isPending && deleteMutation.variables === cat.id}
            />
          ))
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: theme.border }]} />

                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingCategory ? 'Edit Category' : 'New Category'}
                </Text>

                {/* Icon selector */}
                <TouchableOpacity
                  style={[styles.iconPreview, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => setShowIconPicker((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.iconPreviewEmoji}>{form.icon_path}</Text>
                  <Text style={[styles.iconPreviewLabel, { color: theme.textSecondary }]}>
                    Tap to change icon
                  </Text>
                </TouchableOpacity>

                {/* Emoji picker */}
                {showIconPicker && (
                  <View style={[styles.emojiGrid, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 300, gap: 8 }}>
                        {EMOJI_ICONS.map((emoji) => (
                          <TouchableOpacity
                            key={emoji}
                            style={[
                              styles.emojiOption,
                              form.icon_path === emoji && { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
                            ]}
                            onPress={() => {
                              setForm((p) => ({ ...p, icon_path: emoji }));
                              setShowIconPicker(false);
                            }}
                          >
                            <Text style={styles.emojiText}>{emoji}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                    <TouchableOpacity
                      style={[styles.uploadBtn, { borderColor: theme.border }]}
                      onPress={pickImage}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.uploadBtnText, { color: theme.textSecondary }]}>
                        📷 Pick from Gallery
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Name input */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
                    ]}
                    value={form.name}
                    onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                    placeholder="Category name"
                    placeholderTextColor={theme.textMuted}
                    maxLength={40}
                  />
                </View>

                {/* Color picker */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Color</Text>
                  <View style={styles.colorPalette}>
                    {COLORS.categoryPalette.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: color },
                          form.color_hex === color && styles.selectedSwatch,
                        ]}
                        onPress={() => setForm((p) => ({ ...p, color_hex: color }))}
                        activeOpacity={0.8}
                      >
                        {form.color_hex === color && (
                          <Text style={styles.colorCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Preview */}
                <View style={[styles.preview, { backgroundColor: `${form.color_hex}15`, borderColor: `${form.color_hex}40` }]}>
                  <View style={[styles.previewDot, { backgroundColor: form.color_hex }]} />
                  <Text style={[styles.previewName, { color: form.color_hex }]}>
                    {form.name || 'Category Preview'}
                  </Text>
                </View>

                {/* Save */}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: COLORS.primary, opacity: isSaving ? 0.7 : 1 }]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.8}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingCategory ? 'Save Changes' : 'Create Category'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function CategoryRow({
  category,
  theme,
  isSystem,
  onEdit,
  onDelete,
  isDeleting,
}: {
  category: Category;
  theme: ReturnType<typeof useAppTheme>;
  isSystem: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={[styles.rowDot, { backgroundColor: category.color_hex || COLORS.primary }]} />
      <Text style={styles.rowIcon}>{category.icon_path}</Text>
      <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>
        {category.name}
      </Text>
      {isSystem ? (
        <Text style={[styles.lockIcon, { color: theme.textMuted }]}>🔒</Text>
      ) : (
        <View style={styles.rowActions}>
          <TouchableOpacity onPress={onEdit} style={styles.rowBtn} activeOpacity={0.8}>
            <Text style={styles.rowBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.rowBtn} disabled={isDeleting} activeOpacity={0.8}>
            {isDeleting ? (
              <ActivityIndicator size={14} color={COLORS.danger} />
            ) : (
              <Text style={styles.rowBtnText}>🗑</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  empty: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 28, opacity: 0.4 },
  emptyText: { fontSize: 13, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  rowDot: { width: 10, height: 10, borderRadius: 5 },
  rowIcon: { fontSize: 18 },
  rowName: { flex: 1, fontSize: 14, fontWeight: '500' },
  lockIcon: { fontSize: 14 },
  rowActions: { flexDirection: 'row', gap: 8 },
  rowBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rowBtnText: { fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, gap: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  iconPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  iconPreviewEmoji: { fontSize: 28 },
  iconPreviewLabel: { fontSize: 14 },
  emojiGrid: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiText: { fontSize: 22 },
  uploadBtn: { paddingVertical: 10, borderTopWidth: 1, alignItems: 'center' },
  uploadBtnText: { fontSize: 13, fontWeight: '500' },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  colorPalette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSwatch: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCheck: { color: '#FFF', fontSize: 14, fontWeight: '900' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewName: { fontSize: 14, fontWeight: '600' },
  saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
