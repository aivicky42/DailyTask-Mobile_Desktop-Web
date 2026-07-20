import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase, toBool } from '../db/database';
import { AppError } from '../middleware/errorHandler';
import { Category } from '../types';

const router = Router();

const OTHERS_ID = '00000000-0000-0000-0000-000000000006';

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    ...(row as Omit<Category, 'is_system'>),
    is_system: toBool(row['is_system'] as number),
  };
}

function validateColorHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ─── GET /api/v1/categories ───────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getDatabase();
    const rows = db
      .prepare(`
        SELECT * FROM categories
        WHERE deleted_at IS NULL
        ORDER BY is_system DESC, name ASC
      `)
      .all() as Record<string, unknown>[];

    res.json(rows.map(rowToCategory));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/categories ──────────────────────────────────────────────────
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, icon_path, color_hex } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError(400, 'Validation Error', 'name is required and must be a non-empty string.');
    }
    if (name.toString().length > 50) {
      throw new AppError(400, 'Validation Error', 'name must be 50 characters or fewer.');
    }
    if (color_hex !== undefined && !validateColorHex(color_hex as string)) {
      throw new AppError(400, 'Validation Error', "color_hex must be a valid 6-digit hex color (e.g. '#2196F3').");
    }

    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO categories (id, owner_id, name, icon_path, is_system, color_hex, sync_version)
      VALUES (?, NULL, ?, ?, 0, ?, 1)
    `).run(
      id,
      (name as string).trim(),
      (icon_path as string | null | undefined) ?? null,
      (color_hex as string | undefined) ?? '#808080',
    );

    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(rowToCategory(row));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/v1/categories/:id ────────────────────────────────────────────
router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const category = db
      .prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Record<string, unknown> | undefined;

    if (!category) {
      throw new AppError(404, 'Not Found', `Category '${id}' not found.`);
    }
    if (toBool(category['is_system'] as number)) {
      throw new AppError(403, 'Forbidden', 'System categories cannot be modified.');
    }

    const { name, icon_path, color_hex } = req.body as Record<string, unknown>;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError(400, 'Validation Error', 'name must be a non-empty string.');
      }
      if (name.length > 50) {
        throw new AppError(400, 'Validation Error', 'name must be 50 characters or fewer.');
      }
    }
    if (color_hex !== undefined && !validateColorHex(color_hex as string)) {
      throw new AppError(400, 'Validation Error', "color_hex must be a valid 6-digit hex color.");
    }

    // Build dynamic SET clause
    const sets: string[] = ['updated_at = datetime(\'now\')', 'sync_version = sync_version + 1'];
    const params: unknown[] = [];

    if (name !== undefined) { sets.push('name = ?'); params.push((name as string).trim()); }
    if (icon_path !== undefined) { sets.push('icon_path = ?'); params.push(icon_path); }
    if (color_hex !== undefined) { sets.push('color_hex = ?'); params.push(color_hex); }

    params.push(id);

    db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Record<string, unknown>;
    res.json(rowToCategory(updated));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/categories/:id ───────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    if (id === OTHERS_ID) {
      throw new AppError(403, 'Forbidden', "The 'Others' fallback category cannot be deleted.");
    }

    const category = db
      .prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL')
      .get(id) as Record<string, unknown> | undefined;

    if (!category) {
      throw new AppError(404, 'Not Found', `Category '${id}' not found.`);
    }
    if (toBool(category['is_system'] as number)) {
      throw new AppError(403, 'Forbidden', 'System categories cannot be deleted.');
    }

    const deleteAndReassign = db.transaction(() => {
      // Reassign any task templates that belong to this category → Others
      db.prepare(`
        UPDATE task_templates
        SET category_id = ?, updated_at = datetime('now'), sync_version = sync_version + 1
        WHERE category_id = ? AND deleted_at IS NULL
      `).run(OTHERS_ID, id);

      // Reassign any task occurrences → Others
      db.prepare(`
        UPDATE task_occurrences
        SET category_id = ?, updated_at = datetime('now'), sync_version = sync_version + 1
        WHERE category_id = ? AND deleted_at IS NULL
      `).run(OTHERS_ID, id);

      // Soft-delete the category
      db.prepare(`
        UPDATE categories
        SET deleted_at = datetime('now'), updated_at = datetime('now'), sync_version = sync_version + 1
        WHERE id = ?
      `).run(id);
    });

    deleteAndReassign();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
