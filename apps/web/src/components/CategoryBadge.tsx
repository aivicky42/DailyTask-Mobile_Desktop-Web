import { cn } from '../lib/utils';
import type { Category } from '../types';

interface CategoryBadgeProps {
  category: Category | undefined;
  className?: string;
  showIcon?: boolean;
}

export default function CategoryBadge({
  category,
  className,
  showIcon = true,
}: CategoryBadgeProps) {
  if (!category) {
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', className)}>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Uncategorized
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium select-none',
        className,
      )}
      style={{
        backgroundColor: `${category.color_hex}20`,
        color: category.color_hex,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: category.color_hex }}
      />
      {showIcon && category.icon_path && (
        <span className="text-xs leading-none">{category.icon_path}</span>
      )}
      {category.name}
    </span>
  );
}
