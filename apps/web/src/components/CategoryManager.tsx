import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Check, Tag } from 'lucide-react';
import { cn } from '../lib/utils';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/client';
import type { Category } from '../types';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#6366F1', '#A855F7',
  '#EC4899', '#64748B',
];

const PRESET_ICONS = ['📁', '💼', '🏠', '💡', '📚', '🎯', '💪', '🎨', '🔧', '🌱', '⭐', '🎵'];

interface CategoryFormProps {
  initial?: Partial<Category>;
  onSave: (data: { name: string; icon_path: string; color_hex: string }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

function CategoryForm({ initial, onSave, onCancel, isSaving }: CategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon_path ?? '📁');
  const [color, setColor] = useState(initial?.color_hex ?? '#6366F1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon_path: icon, color_hex: color });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-3">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Category Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Work, Personal..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          autoFocus
        />
      </div>

      {/* Icon */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Icon
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={cn(
                'w-8 h-8 rounded-lg text-base flex items-center justify-center transition-colors',
                icon === ic
                  ? 'bg-primary/20 ring-2 ring-primary'
                  : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600',
              )}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-7 h-7 rounded-full transition-transform hover:scale-110',
                color === c && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-gray-400',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-primary transition-colors" title="Custom color">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
            />
            <span className="text-gray-400 text-xs">+</span>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{color}</span>
        </div>
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Preview:</span>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          {icon} {name || 'Category'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || isSaving}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function CategoryManager() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setShowAdd(false);
    },
    onError: (error: Error) => {
      alert(error?.message ?? 'Failed to create category.');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCategory>[1] }) =>
      updateCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
    },
    onError: (error: Error) => {
      alert(error?.message ?? 'Failed to update category.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (error: Error) => {
      alert(error?.message ?? 'Failed to delete category.');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) =>
        editingId === cat.id ? (
          <CategoryForm
            key={cat.id}
            initial={cat}
            onSave={(data) => updateMut.mutate({ id: cat.id, data })}
            onCancel={() => setEditingId(null)}
            isSaving={updateMut.isPending}
          />
        ) : (
          <div
            key={cat.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 group"
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ backgroundColor: `${cat.color_hex}20` }}
            >
              {cat.icon_path}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{cat.color_hex}</p>
            </div>
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: cat.color_hex }}
            />
            {!cat.is_system && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingId(cat.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${cat.name}"?`)) deleteMut.mutate(cat.id);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            {cat.is_system && (
              <span className="text-[10px] font-medium text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                System
              </span>
            )}
          </div>
        ),
      )}

      {showAdd ? (
        <CategoryForm
          onSave={(data) => createMut.mutate(data)}
          onCancel={() => setShowAdd(false)}
          isSaving={createMut.isPending}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-primary hover:text-primary dark:hover:text-primary transition-colors"
        >
          <Plus size={16} />
          Add Category
        </button>
      )}
    </div>
  );
}
