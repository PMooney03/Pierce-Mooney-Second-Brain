import type { NutritionFacts } from '../types';
import { hasNutrition } from '../types';

const NUTRI_SCORE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500',
  B: 'bg-lime-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  E: 'bg-red-500',
};

type Props = {
  nutrition: NutritionFacts;
  compact?: boolean;
};

const NUTRIENT_FIELDS = [
  { key: 'calories', label: 'Calories', unit: ' kcal' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'sugar', label: 'Sugars', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'saturatedFat', label: 'Sat. fat', unit: 'g' },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'salt', label: 'Salt', unit: 'g' },
] as const;

export default function NutritionFactsPanel({ nutrition, compact = false }: Props) {
  if (!hasNutrition(nutrition)) {
    return (
      <p className="text-base text-teal-600 dark:text-teal-400">No nutrition data available</p>
    );
  }

  const score = nutrition.nutriScore?.toUpperCase();
  const hasScore = score && ['A', 'B', 'C', 'D', 'E'].includes(score);
  const visibleNutrients = NUTRIENT_FIELDS.filter(({ key }) => nutrition[key] != null);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
          Per {nutrition.per ?? '100g'}
          {nutrition.servingSize ? ` · Serving: ${nutrition.servingSize}` : ''}
        </p>
        {hasScore && (
          <div className="shrink-0 text-right">
            <span
              className={`inline-block rounded-md px-2 py-0.5 text-sm font-bold text-white ${NUTRI_SCORE_COLORS[score]}`}
            >
              {score}
            </span>
            <p className="mt-0.5 text-xs font-medium text-teal-600 dark:text-teal-400">Nutri-Score</p>
          </div>
        )}
      </div>
      {hasScore && (
        <p className={`text-teal-600 dark:text-teal-400 ${compact ? 'text-xs' : 'text-sm'}`}>
          {compact
            ? 'Food quality grade — A is best, E is worst. Check carbs & sugar for blood sugar.'
            : 'Nutri-Score is a food quality grade from Open Food Facts: A (healthiest) through E (least healthy). It is a general guide — for diabetes, pay close attention to carbs and sugar below.'}
        </p>
      )}
      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {visibleNutrients.map(({ key, label, unit }) => (
          <div
            key={key}
            className={`rounded-lg bg-teal-50 p-2 dark:bg-teal-800 ${compact ? 'text-sm' : ''}`}
          >
            <p className="text-teal-600 dark:text-teal-400">{label}</p>
            <p className="font-semibold text-teal-900 dark:text-teal-50">
              {nutrition[key]}{unit}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs text-teal-500">Data from Open Food Facts</p>
    </div>
  );
}
