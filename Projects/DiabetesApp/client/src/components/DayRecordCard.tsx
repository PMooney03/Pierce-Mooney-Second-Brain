import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, HeartPulse, Moon, Sun, UtensilsCrossed, X } from 'lucide-react';
import NutritionFactsPanel from './NutritionFacts';
import type { DaySummary } from '../historyUtils';
import { countTabletsTaken, TABLET_COUNT, tabletsDayLabel } from '../medUtils';
import { formatDateLong, formatTime, hasNutrition, mealToNutrition } from '../types';

type Props = {
  day: DaySummary;
  defaultOpen?: boolean;
  expandedOnly?: boolean;
};

export default function DayRecordCard({ day, defaultOpen = false, expandedOnly = false }: Props) {
  const [open, setOpen] = useState(defaultOpen || expandedOnly);
  const tabletStatus = tabletsDayLabel(day.morningTaken, day.eveningTaken, day.bpTaken);
  const tabletsTaken = countTabletsTaken({ morning: day.morningTaken, evening: day.eveningTaken, bp: day.bpTaken });

  const details = <DayDetails day={day} padded={expandedOnly} />;

  if (expandedOnly) {
    return (
      <article className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-teal-900">
        {details}
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-teal-900">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex-1">
          <p className="text-lg font-bold text-teal-900 dark:text-teal-50">{formatDateLong(day.date)}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 ${
                tabletStatus.tone === 'good'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                  : tabletStatus.tone === 'bad'
                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
              }`}
            >
              Tablets {tabletsTaken}/{TABLET_COUNT} · {tabletStatus.text}
            </span>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800 dark:bg-teal-800 dark:text-teal-200">
              {day.mealCount} meal{day.mealCount !== 1 ? 's' : ''}
            </span>
            {day.totalCalories > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                {Math.round(day.totalCalories)} kcal
              </span>
            )}
          </div>
        </div>
        {open ? (
          <ChevronUp className="text-teal-500" size={22} />
        ) : (
          <ChevronDown className="text-teal-500" size={22} />
        )}
      </button>

      {open && details}
    </article>
  );
}

function DayDetails({ day, padded }: { day: DaySummary; padded?: boolean }) {
  return (
    <div
      className={`space-y-3 ${
        padded ? 'p-4' : 'border-t border-teal-100 px-4 pb-4 pt-3 dark:border-teal-800'
      }`}
    >
      <MedRow
        label="Morning tablet"
        icon={Sun}
        taken={day.morningTaken}
        time={day.morningTime}
      />
      <MedRow
        label="BP tablet"
        icon={HeartPulse}
        taken={day.bpTaken}
        time={day.bpTime}
      />
      <MedRow
        label="Evening tablet"
        icon={Moon}
        taken={day.eveningTaken}
        time={day.eveningTime}
      />

      <div>
        <div className="mb-2 flex items-center gap-2 font-semibold text-teal-900 dark:text-teal-50">
          <UtensilsCrossed size={18} />
          Meals
        </div>
        {day.meals.length === 0 ? (
          <p className="rounded-xl bg-teal-50 p-3 text-base text-teal-600 dark:bg-teal-800 dark:text-teal-300">
            No meals logged
          </p>
        ) : (
          <ul className="space-y-2">
            {day.meals.map((meal, index) => (
              <li
                key={meal.id != null ? `meal-${meal.id}` : `meal-${day.date}-${index}`}
                className="rounded-xl bg-teal-50 p-3 dark:bg-teal-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-teal-900 dark:text-teal-50">{meal.name}</p>
                  <p className="shrink-0 text-sm text-teal-600 dark:text-teal-400">{meal.time}</p>
                </div>
                {hasNutrition(mealToNutrition(meal)) && (
                  <div className="mt-2">
                    <NutritionFactsPanel nutrition={mealToNutrition(meal)} compact />
                  </div>
                )}
                {meal.notes && (
                  <p className="mt-2 text-sm text-teal-600 dark:text-teal-400">{meal.notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MedRow({
  label,
  icon: Icon,
  taken,
  time,
}: {
  label: string;
  icon: typeof Sun;
  taken: boolean;
  time: string | null;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl p-3 ${
        taken ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-red-50 dark:bg-red-950'
      }`}
    >
      <Icon size={20} className={taken ? 'text-emerald-600' : 'text-red-400'} />
      <div className="flex-1">
        <p className="font-semibold text-teal-900 dark:text-teal-50">{label}</p>
        <p className="text-sm text-teal-700 dark:text-teal-300">
          {taken && time ? `Taken at ${formatTime(time)}` : 'Not taken'}
        </p>
      </div>
      {taken ? <Check className="text-emerald-600" size={20} /> : <X className="text-red-400" size={20} />}
    </div>
  );
}
