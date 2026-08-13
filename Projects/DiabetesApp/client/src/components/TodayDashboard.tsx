import { Pill, UtensilsCrossed, Flame, Wheat } from 'lucide-react';
import MedicationTracker from './MedicationTracker';
import MealList from './MealList';
import WeatherWidget from './WeatherWidget';
import TabletReminderBanner from './TabletReminderBanner';
import EditMealModal from './EditMealModal';
import { summarizeTodayMeals } from '../historyUtils';
import { getMissedTabletSummary, getTabletReminder, slotLabel } from '../tabletUtils';
import { countTabletsTaken, TABLET_COUNT } from '../medUtils';
import type { MedSlot } from '../medUtils';
import type { Meal, MedStatus } from '../types';
import { formatTime } from '../types';
import { useState } from 'react';

type Props = {
  meds: MedStatus;
  meals: Meal[];
  weather: { temp: number; code: number } | null;
  weatherLoading: boolean;
  medLoading: boolean;
  onToggleMed: (slot: MedSlot) => void;
  onDeleteMeal: (id: number) => void;
  onEditMeal: (meal: Meal) => Promise<void>;
  onLogFood: () => void;
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Pill;
  label: string;
  value: string;
  sub?: string;
  highlight?: 'good' | 'warn' | 'neutral' | 'bad';
}) {
  const bg =
    highlight === 'good'
      ? 'bg-emerald-50 dark:bg-emerald-950'
      : highlight === 'warn'
        ? 'bg-amber-50 dark:bg-amber-950'
        : highlight === 'bad'
          ? 'bg-red-50 dark:bg-red-950'
          : 'bg-white dark:bg-teal-900';

  return (
    <div className={`rounded-2xl p-4 shadow-sm ${bg}`}>
      <Icon size={22} className="mb-2 text-teal-600 dark:text-teal-400" />
      <p className="text-sm text-teal-600 dark:text-teal-400">{label}</p>
      <p className="text-2xl font-bold text-teal-900 dark:text-teal-50">{value}</p>
      {sub && <p className="mt-0.5 text-sm text-teal-700 dark:text-teal-300">{sub}</p>}
    </div>
  );
}

export default function TodayDashboard({
  meds,
  meals,
  weather,
  weatherLoading,
  medLoading,
  onToggleMed,
  onDeleteMeal,
  onEditMeal,
  onLogFood,
}: Props) {
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const tabletsTaken = countTabletsTaken({ morning: !!meds.morning, evening: !!meds.evening, bp: !!meds.bp });
  const summary = summarizeTodayMeals(meals);
  const allTaken = tabletsTaken === TABLET_COUNT;
  const missed = getMissedTabletSummary(meds);
  const reminder = getTabletReminder(meds);

  const tabletHighlight = allTaken ? 'good' : tabletsTaken === 0 ? 'bad' : 'warn';

  return (
    <div className="space-y-6">
      <WeatherWidget temp={weather?.temp ?? null} code={weather?.code ?? null} loading={weatherLoading} />

      {reminder && <TabletReminderBanner reminder={reminder} />}

      {!allTaken && missed.length > 0 && !reminder && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            {missed.length === TABLET_COUNT
              ? 'No tablets logged yet today'
              : `${slotLabel(missed[0])} tablet not taken yet`}
          </p>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-bold text-teal-900 dark:text-teal-50">Today's overview</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Pill}
            label="Tablets"
            value={`${tabletsTaken}/${TABLET_COUNT}`}
            sub={
              allTaken
                ? 'All taken'
                : missed.length === TABLET_COUNT
                  ? 'All still to take'
                  : `${slotLabel(missed[0])} missed`
            }
            highlight={tabletHighlight}
          />
          <StatCard
            icon={UtensilsCrossed}
            label="Meals logged"
            value={String(summary.count)}
            sub={summary.count === 0 ? 'Nothing yet' : 'Today'}
          />
          <StatCard
            icon={Flame}
            label="Calories"
            value={summary.calories > 0 ? `${Math.round(summary.calories)}` : '—'}
            sub={summary.calories > 0 ? 'kcal today' : 'Log food to track'}
          />
          <StatCard
            icon={Wheat}
            label="Carbs"
            value={summary.carbs > 0 ? `${Math.round(summary.carbs)}g` : '—'}
            sub={summary.protein > 0 ? `${Math.round(summary.protein)}g protein` : undefined}
          />
        </div>
      </section>

      {(meds.morning || meds.bp || meds.evening) && (
        <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
          <h3 className="mb-2 text-lg font-semibold text-teal-900 dark:text-teal-50">Tablet times today</h3>
          <div className="flex flex-wrap gap-4 text-base text-teal-700 dark:text-teal-300">
            {meds.morning && <span>Morning: {formatTime(meds.morning)}</span>}
            {meds.bp && <span>BP: {formatTime(meds.bp)}</span>}
            {meds.evening && <span>Evening: {formatTime(meds.evening)}</span>}
          </div>
        </section>
      )}

      <MedicationTracker status={meds} onToggle={onToggleMed} loading={medLoading} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Today's meals</h2>
          <button
            type="button"
            onClick={onLogFood}
            className="rounded-xl bg-teal-600 px-4 py-2 text-base font-semibold text-white active:bg-teal-700 dark:bg-teal-500"
          >
            + Log food
          </button>
        </div>
        <MealList
          meals={meals}
          onDelete={onDeleteMeal}
          onEdit={setEditingMeal}
        />
      </section>

      {editingMeal && (
        <EditMealModal
          meal={editingMeal}
          onSave={onEditMeal}
          onClose={() => setEditingMeal(null)}
        />
      )}
    </div>
  );
}
