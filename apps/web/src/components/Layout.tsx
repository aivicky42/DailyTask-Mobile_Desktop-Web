import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Sidebar from './Sidebar';
import TaskModal from './TaskModal';
import { useTheme } from '../hooks/useTheme';

export default function Layout() {
  useTheme(); // keep theme class in sync

  const [showAddTask, setShowAddTask] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <Outlet />
        </div>
      </main>

      {/* Floating add button */}
      <button
        onClick={() => setShowAddTask(true)}
        title="Add new task"
        className="fixed bottom-8 right-8 z-30 w-14 h-14 rounded-full bg-primary hover:bg-primary-600 active:scale-95 text-white shadow-lg shadow-primary/40 flex items-center justify-center transition-all"
      >
        <Plus size={24} />
      </button>

      {/* Add task modal */}
      {showAddTask && (
        <TaskModal
          onClose={() => setShowAddTask(false)}
          onSuccess={() => setShowAddTask(false)}
        />
      )}
    </div>
  );
}
