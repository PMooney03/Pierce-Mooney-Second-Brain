import { Printer } from 'lucide-react';
import DayRecordCard from './DayRecordCard';
import { buildWeekSummary } from '../historyUtils';
import type { HistoryData } from '../types';
import { formatDateLong } from '../types';

type Props = {
  data: HistoryData;
};

export default function WeeklySummaryView({ data }: Props) {
  const week = buildWeekSummary(data);

  return (
    <div className="weekly-summary space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-teal-900 dark:text-teal-50">This week</h3>
          <p className="text-sm text-teal-600 dark:text-teal-400">
            {formatDateLong(week.startDate)} – {formatDateLong(week.endDate)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white print-hidden dark:bg-teal-500"
        >
          <Printer size={18} />
          Print
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Tablets" value={`${week.tabletsTaken}/${week.tabletsExpected}`} />
        <Stat label="Meals logged" value={String(week.mealsLogged)} />
        <Stat label="Avg carbs/day" value={week.avgCarbs > 0 ? `${week.avgCarbs}g` : '—'} />
        <Stat label="Avg calories/day" value={week.avgCalories > 0 ? `${week.avgCalories}` : '—'} />
      </div>

      {week.daysWithMissedTablets > 0 && (
        <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {week.daysWithMissedTablets} day{week.daysWithMissedTablets !== 1 ? 's' : ''} with missed tablet
          {week.daysWithMissedTablets !== 1 ? 's' : ''} this week
        </p>
      )}

      <div className="space-y-3">
        {week.days.map((day) => (
          <DayRecordCard key={day.date} day={day} expandedOnly />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
      <p className="text-sm text-teal-600 dark:text-teal-400">{label}</p>
      <p className="text-2xl font-bold text-teal-900 dark:text-teal-50">{value}</p>
    </div>
  );
}
