import { Trash2, UtensilsCrossed, Pencil } from 'lucide-react';
import NutritionFactsPanel from './NutritionFacts';
import type { Meal } from '../types';
import { hasNutrition, mealToNutrition } from '../types';

type Props = {
  meals: Meal[];
  onDelete: (id: number) => void;
  onEdit?: (meal: Meal) => void;
};

export default function MealList({ meals, onDelete, onEdit }: Props) {
  if (meals.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-teal-900">
        <UtensilsCrossed size={40} className="mx-auto mb-3 text-teal-300 dark:text-teal-600" />
        <p className="text-xl text-teal-700 dark:text-teal-300">No meals logged yet today</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {meals.map((meal) => {
        const nutrition = mealToNutrition(meal);
        return (
          <li
            key={meal.id}
            className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900"
          >
            <div className="flex-1">
              <p className="text-xl font-semibold text-teal-900 dark:text-teal-50">{meal.name}</p>
              <p className="text-lg text-teal-600 dark:text-teal-400">{meal.time}</p>
              {hasNutrition(nutrition) && (
                <div className="mt-3">
                  <NutritionFactsPanel nutrition={nutrition} compact />
                </div>
              )}
              {meal.notes && <p className="mt-2 text-base text-teal-600 dark:text-teal-400">{meal.notes}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(meal)}
                  className="rounded-xl p-3 text-teal-500 hover:bg-teal-50 active:bg-teal-100 dark:hover:bg-teal-800"
                  aria-label={`Edit ${meal.name}`}
                >
                  <Pencil size={22} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(meal.id)}
                className="rounded-xl p-3 text-red-400 hover:bg-red-50 active:bg-red-100 dark:hover:bg-red-950"
                aria-label={`Delete ${meal.name}`}
              >
                <Trash2 size={22} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
