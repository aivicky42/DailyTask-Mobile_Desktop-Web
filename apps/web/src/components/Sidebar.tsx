import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Settings,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTimerStore } from '../store/timerStore';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',     icon: CheckSquare,     label: 'Tasks'     },
  { to: '/calendar',  icon: Calendar,        label: 'Calendar'  },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
] as const;

export default function Sidebar() {
  const isRunning = useTimerStore((s) => s.isRunning);

  return (
    <aside className="w-60 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <CheckSquare size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">
              DailyTask
            </span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-0.5">
              Stay on track
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary/10 dark:bg-primary/20 text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/60 hover:text-gray-900 dark:hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={isActive ? 'text-primary' : undefined}
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Timer indicator */}
      {isRunning && (
        <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">Timer running</span>
            <Zap size={12} className="ml-auto text-primary" />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-300 dark:text-gray-600">v1.0.0</p>
      </div>
    </aside>
  );
}
