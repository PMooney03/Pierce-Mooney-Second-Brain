import { CalendarDays, Home, UtensilsCrossed } from 'lucide-react';
import type { Tab } from '../types';

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'today', label: 'Dashboard', icon: Home },
  { id: 'food', label: 'Food', icon: UtensilsCrossed },
  { id: 'history', label: 'History', icon: CalendarDays },
];

type Props = {
  active: Tab;
  onChange: (tab: Tab) => void;
};

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t border-teal-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-teal-800 dark:bg-teal-900">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-base font-semibold ${
                selected ? 'text-teal-700 dark:text-teal-300' : 'text-teal-400 dark:text-teal-600'
              }`}
            >
              <Icon size={28} strokeWidth={selected ? 2.5 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
