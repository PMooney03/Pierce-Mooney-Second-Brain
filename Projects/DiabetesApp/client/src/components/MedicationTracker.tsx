import { Check, Pill, Sun, Moon, HeartPulse } from 'lucide-react';
import type { MedStatus } from '../types';
import type { MedSlot } from '../medUtils';
import { formatTime } from '../types';

type Props = {
  status: MedStatus;
  onToggle: (slot: MedSlot) => void;
  loading?: boolean;
};

function MedButton({
  label,
  icon: Icon,
  takenAt,
  slot,
  onToggle,
  loading,
}: {
  label: string;
  icon: typeof Sun;
  takenAt: string | null;
  slot: MedSlot;
  onToggle: (slot: MedSlot) => void;
  loading?: boolean;
}) {
  const taken = !!takenAt;

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => onToggle(slot)}
      className={`w-full rounded-2xl border-4 p-6 text-left transition-all active:scale-[0.98] disabled:opacity-60 ${
        taken
          ? 'border-emerald-500 bg-emerald-50 shadow-md dark:border-emerald-600 dark:bg-emerald-950'
          : 'border-teal-200 bg-white shadow-sm hover:border-teal-400 dark:border-teal-700 dark:bg-teal-900 dark:hover:border-teal-500'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${
            taken
              ? 'bg-emerald-500 text-white'
              : 'bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200'
          }`}
        >
          {taken ? <Check size={32} strokeWidth={3} /> : <Icon size={32} />}
        </div>
        <div className="flex-1">
          <p className="text-xl font-bold text-teal-900 dark:text-teal-50">{label}</p>
          <p className="text-lg text-teal-700 dark:text-teal-300">
            {taken ? `Taken at ${formatTime(takenAt)}` : 'Tap when taken'}
          </p>
        </div>
        <Pill size={28} className={taken ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-300 dark:text-teal-600'} />
      </div>
    </button>
  );
}

export default function MedicationTracker({ status, onToggle, loading }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Today's Tablets</h2>
      <p className="text-lg text-teal-700 dark:text-teal-300">Tap each one after you take it</p>
      <MedButton
        label="Morning tablet"
        icon={Sun}
        takenAt={status.morning}
        slot="morning"
        onToggle={onToggle}
        loading={loading}
      />
      <MedButton
        label="BP tablet"
        icon={HeartPulse}
        takenAt={status.bp}
        slot="bp"
        onToggle={onToggle}
        loading={loading}
      />
      <MedButton
        label="Evening tablet"
        icon={Moon}
        takenAt={status.evening}
        slot="evening"
        onToggle={onToggle}
        loading={loading}
      />
    </section>
  );
}
