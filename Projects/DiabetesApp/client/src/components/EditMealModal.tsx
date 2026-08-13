import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import NutritionFactsPanel from './NutritionFacts';
import type { Meal } from '../types';
import { hasNutrition, mealToNutrition, nutritionToMealFields } from '../types';

const inputClass =
  'w-full rounded-xl border-2 border-teal-200 px-4 py-3 text-lg dark:border-teal-700';

type Props = {
  meal: Meal;
  onSave: (meal: Meal) => Promise<void>;
  onClose: () => void;
};

export default function EditMealModal({ meal, onSave, onClose }: Props) {
  const [name, setName] = useState(meal.name);
  const [date, setDate] = useState(meal.date);
  const [time, setTime] = useState(meal.time);
  const [notes, setNotes] = useState(meal.notes ?? '');
  const [calories, setCalories] = useState(meal.calories?.toString() ?? '');
  const [carbs, setCarbs] = useState(meal.carbs?.toString() ?? '');
  const [protein, setProtein] = useState(meal.protein?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const nutrition = nutritionToMealFields({
        calories: calories ? Number(calories) : null,
        carbs: carbs ? Number(carbs) : null,
        protein: protein ? Number(protein) : null,
        sugar: meal.sugar,
        fat: meal.fat,
        saturatedFat: meal.saturated_fat,
        fiber: meal.fiber,
        salt: meal.salt,
        nutriScore: meal.nutri_score,
        servingSize: meal.serving_size,
      });
      await onSave({
        ...meal,
        name: name.trim(),
        date,
        time,
        notes: notes.trim() || null,
        ...nutrition,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  const preview = mealToNutrition({
    ...meal,
    calories: calories ? Number(calories) : null,
    carbs: carbs ? Number(carbs) : null,
    protein: protein ? Number(protein) : null,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      data-no-swipe
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-teal-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Edit meal</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-800"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Calories</label>
              <input type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Carbs (g)</label>
              <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Protein (g)</label>
              <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} className={inputClass} />
            </div>
          </div>
          {hasNutrition(preview) && (
            <div className="rounded-xl border-2 border-teal-100 p-3 dark:border-teal-700">
              <NutritionFactsPanel nutrition={preview} compact />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          {error && <p className="text-lg text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-teal-600 py-4 text-xl font-bold text-white disabled:opacity-60 dark:bg-teal-500"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
