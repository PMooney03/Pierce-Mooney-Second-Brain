import { useState, type ReactNode } from 'react';
import BiweeklyView from './BiweeklyView';
import DayRecordCard from './DayRecordCard';
import DayView from './DayView';
import WeeklySummaryView from './WeeklySummaryView';
import { buildDays, groupBiweekly, summarizeDay } from '../historyUtils';
import type { HistoryData } from '../types';
import { todayString } from '../types';

export type HistoryMode = 'day' | 'week' | 'biweekly' | 'all';

type Props = {
  data: HistoryData | null;
  loading?: boolean;
};

export default function HistoryView({ data, loading }: Props) {
  const [mode, setMode] = useState<HistoryMode>('day');
  const [selectedDate, setSelectedDate] = useState(todayString);

  if (loading) {
    return <p className="text-xl text-teal-600 dark:text-teal-400">Loading history...</p>;
  }

  if (!data) {
    return <p className="text-xl text-teal-600 dark:text-teal-400">No history yet</p>;
  }

  const days = buildDays(data);
  const biweeklyPeriods = groupBiweekly(data);

  if (days.length === 0 && mode !== 'day') {
    return (
      <div className="space-y-4">
        <Header mode={mode} setMode={setMode} />
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-teal-900">
          <p className="text-xl text-teal-700 dark:text-teal-300">Start logging and history will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header mode={mode} setMode={setMode} />

      {mode === 'day' && (
        <DayView data={data} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      )}

      {mode === 'week' && <WeeklySummaryView data={data} />}

      {mode === 'biweekly' && <BiweeklyView periods={biweeklyPeriods} />}

      {mode === 'all' && (
        <div className="space-y-3">
          <p className="text-sm text-teal-600 dark:text-teal-400">
            {days.length} day{days.length !== 1 ? 's' : ''} recorded — tap a day to expand
          </p>
          {days.map((date, i) => (
            <DayRecordCard
              key={date}
              day={summarizeDay(data, date)}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ mode, setMode }: { mode: HistoryMode; setMode: (m: HistoryMode) => void }) {
  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">History</h2>
        <p className="text-base text-teal-600 dark:text-teal-400">
          Review tablets and meals over time
        </p>
      </div>

      <div className="flex rounded-2xl bg-white p-1 shadow-sm dark:bg-teal-900">
        <ModeButton active={mode === 'day'} onClick={() => setMode('day')}>
          Day
        </ModeButton>
        <ModeButton active={mode === 'week'} onClick={() => setMode('week')}>
          Week
        </ModeButton>
        <ModeButton active={mode === 'biweekly'} onClick={() => setMode('biweekly')}>
          2 weeks
        </ModeButton>
        <ModeButton active={mode === 'all'} onClick={() => setMode('all')}>
          All
        </ModeButton>
      </div>
    </>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors sm:text-base ${
        active
          ? 'bg-teal-600 text-white dark:bg-teal-500'
          : 'text-teal-600 dark:text-teal-400'
      }`}
    >
      {children}
    </button>
  );
}
