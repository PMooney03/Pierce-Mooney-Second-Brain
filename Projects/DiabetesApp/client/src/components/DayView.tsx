import { ChevronLeft, ChevronRight } from 'lucide-react';
import DayRecordCard from './DayRecordCard';
import { summarizeDay } from '../historyUtils';
import type { HistoryData } from '../types';
import { formatDateLong, todayString } from '../types';

type Props = {
  data: HistoryData;
  selectedDate: string;
  onDateChange: (date: string) => void;
};

function shiftDate(date: string, days: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DayView({ data, selectedDate, onDateChange }: Props) {
  const day = summarizeDay(data, selectedDate);
  const isToday = selectedDate === todayString();
  const hasData = day.morningTaken || day.eveningTaken || day.bpTaken || day.meals.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDateChange(shiftDate(selectedDate, -1))}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 active:bg-teal-200 dark:bg-teal-800 dark:text-teal-100"
            aria-label="Previous day"
          >
            <ChevronLeft size={28} />
          </button>

          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-teal-900 dark:text-teal-50">
              {formatDateLong(selectedDate)}
            </p>
            {isToday && (
              <span className="mt-1 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-sm font-semibold text-teal-800 dark:bg-teal-800 dark:text-teal-200">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDateChange(shiftDate(selectedDate, 1))}
            disabled={isToday}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 active:bg-teal-200 disabled:opacity-40 dark:bg-teal-800 dark:text-teal-100"
            aria-label="Next day"
          >
            <ChevronRight size={28} />
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={() => onDateChange(todayString())}
            className="mt-3 w-full rounded-xl bg-teal-600 py-3 text-base font-semibold text-white active:bg-teal-700 dark:bg-teal-500"
          >
            Jump to today
          </button>
        )}

        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-medium text-teal-600 dark:text-teal-400">
            Pick a date
          </span>
          <input
            type="date"
            value={selectedDate}
            max={todayString()}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            className="h-11 max-w-[11.5rem] rounded-lg border-2 border-teal-200 bg-teal-50 px-2 text-base text-teal-900 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-50"
          />
        </label>
      </div>

      {!hasData ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-teal-900">
          <p className="text-xl text-teal-700 dark:text-teal-300">Nothing logged on this day</p>
        </div>
      ) : (
        <DayRecordCard key={selectedDate} day={day} expandedOnly />
      )}

      {(day.totalCalories > 0 || day.totalCarbs > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {day.totalCalories > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
              <p className="text-sm text-teal-600 dark:text-teal-400">Day total calories</p>
              <p className="text-2xl font-bold text-teal-900 dark:text-teal-50">
                {Math.round(day.totalCalories)} kcal
              </p>
            </div>
          )}
          {day.totalCarbs > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
              <p className="text-sm text-teal-600 dark:text-teal-400">Day total carbs</p>
              <p className="text-2xl font-bold text-teal-900 dark:text-teal-50">
                {Math.round(day.totalCarbs)}g
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
