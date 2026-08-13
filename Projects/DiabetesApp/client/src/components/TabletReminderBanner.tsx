import { AlertTriangle } from 'lucide-react';
import type { TabletReminder } from '../tabletUtils';

type Props = {
  reminder: TabletReminder;
};

export default function TabletReminderBanner({ reminder }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950"
    >
      <AlertTriangle className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" size={24} />
      <div>
        <p className="text-lg font-bold text-red-900 dark:text-red-100">Tablet reminder</p>
        <p className="text-base text-red-800 dark:text-red-200">{reminder.message}</p>
      </div>
    </div>
  );
}
