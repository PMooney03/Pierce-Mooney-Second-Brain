import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import DayRecordCard from './DayRecordCard';
import type { BiweeklyPeriod } from '../historyUtils';

type Props = {
  periods: BiweeklyPeriod[];
};

function PeriodBlock({ period, defaultOpen }: { period: BiweeklyPeriod; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const adherence = period.tabletsExpected
    ? Math.round((period.tabletsTaken / period.tabletsExpected) * 100)
    : 0;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-teal-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 p-5 text-left"
      >
        <div className="flex-1">
          <p className="text-xl font-bold text-teal-900 dark:text-teal-50">{period.label}</p>
          <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">2-week period</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryPill key="tablets" label="Tablets" value={`${period.tabletsTaken}/${period.tabletsExpected}`} />
            <SummaryPill key="adherence" label="Adherence" value={`${adherence}%`} />
            <SummaryPill key="meals" label="Meals" value={String(period.mealsLogged)} />
            <SummaryPill
              key="carbs"
              label="Carbs"
              value={period.totalCarbs > 0 ? `${Math.round(period.totalCarbs)}g` : '—'}
            />
          </div>
        </div>
        {open ? (
          <ChevronUp className="mt-1 shrink-0 text-teal-500" size={22} />
        ) : (
          <ChevronDown className="mt-1 shrink-0 text-teal-500" size={22} />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-teal-100 px-4 pb-4 pt-2 dark:border-teal-800">
          {period.days.map((day, i) => (
            <DayRecordCard key={day.date} day={day} defaultOpen={i === 0 && defaultOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-teal-50 p-2 dark:bg-teal-800">
      <p className="text-xs text-teal-600 dark:text-teal-400">{label}</p>
      <p className="font-bold text-teal-900 dark:text-teal-50">{value}</p>
    </div>
  );
}

export default function BiweeklyView({ periods }: Props) {
  if (periods.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-teal-900">
        <p className="text-xl text-teal-700 dark:text-teal-300">No data for the last 2 weeks yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {periods.map((period, i) => (
        <PeriodBlock key={period.id} period={period} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
