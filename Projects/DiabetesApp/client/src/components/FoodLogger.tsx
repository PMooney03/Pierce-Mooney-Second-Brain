import { useEffect, useState } from 'react';
import { Plus, Search, ScanBarcode, History, Camera } from 'lucide-react';
import { api } from '../api';
import { QUICK_MEALS, type QuickMeal } from '../quickMeals';
import NutritionFactsPanel from './NutritionFacts';
import BarcodeScanner from './BarcodeScanner';
import type { FoodResult, FrequentMeal } from '../types';
import { hasNutrition, nutritionToMealFields, todayString } from '../types';

const inputClass =
  'rounded-xl border-2 border-teal-200 px-4 py-4 text-lg dark:border-teal-700';

const emptyNutrition = (): FoodResult => ({
  name: '',
  calories: null,
  carbs: null,
  sugar: null,
  fat: null,
  saturatedFat: null,
  protein: null,
  fiber: null,
  salt: null,
  nutriScore: null,
  servingSize: null,
  per: '100g',
});

type Props = {
  onAdded: () => void;
};

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function FoodLogger({ onAdded }: Props) {
  const [name, setName] = useState('');
  const [nutrition, setNutrition] = useState<FoodResult>(emptyNutrition());
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [frequentMeals, setFrequentMeals] = useState<FrequentMeal[]>([]);
  const [frequentLoading, setFrequentLoading] = useState(true);

  useEffect(() => {
    api.getFrequentMeals()
      .then(setFrequentMeals)
      .catch(() => setFrequentMeals([]))
      .finally(() => setFrequentLoading(false));
  }, []);
  function applyFood(item: FoodResult) {
    setName(item.name);
    setNutrition({ ...item, name: item.name, per: item.per ?? '100g' });
    document.getElementById('add-meal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetForm() {
    setName('');
    setNutrition(emptyNutrition());
    setNotes('');
    setSearch('');
    setResults([]);
  }

  async function saveMeal(data: { name: string; time?: string; notes?: string } & Partial<FoodResult>) {
    setSaving(true);
    setError('');
    try {
      await api.addMeal({
        date: todayString(),
        time: data.time ?? nowTime(),
        name: data.name,
        notes: data.notes ?? null,
        ...nutritionToMealFields(data),
      });
      resetForm();
      onAdded();
      api.getFrequentMeals().then(setFrequentMeals).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save meal');
    } finally {
      setSaving(false);
    }
  }

  async function handleSearch() {
    if (!search.trim()) return;
    setSearching(true);
    setError('');
    try {
      const items = await api.searchFood(search.trim());
      setResults(items);
    } catch {
      setError('Search failed — try typing the food name manually');
    } finally {
      setSearching(false);
    }
  }

  async function lookupCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcode(trimmed);
    setSearching(true);
    setError('');
    try {
      const item = await api.lookupBarcode(trimmed);
      applyFood(item);
    } catch {
      setError('Barcode not found — enter the food manually');
    } finally {
      setSearching(false);
    }
  }

  async function handleBarcode() {
    await lookupCode(barcode);
  }

  function handleCameraScan(code: string) {
    setScanning(false);
    void lookupCode(code);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Quick add</h2>
          <p className="text-base text-teal-600 dark:text-teal-400">
            Usual meals — tap to log with the right time
          </p>
        </div>

        {QUICK_MEALS.map((section) => (
          <div key={section.title}>
            <h3 className="mb-1 text-xl font-bold text-teal-800 dark:text-teal-200">{section.title}</h3>
            {section.subtitle && (
              <p className="mb-2 text-sm text-teal-600 dark:text-teal-400">{section.subtitle}</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {section.items.map((item) => (
                <QuickMealButton key={item.name} item={item} saving={saving} onSave={saveMeal} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {(frequentLoading || frequentMeals.length > 0) && (
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Your meals</h2>
            <p className="text-base text-teal-600 dark:text-teal-400">
              Logged before — tap to add again with saved nutrition
            </p>
          </div>
          {frequentLoading ? (
            <p className="text-base text-teal-600 dark:text-teal-400">Loading your meals…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {frequentMeals.map((item) => (
                <FrequentMealButton key={item.name} item={item} saving={saving} onSave={saveMeal} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Search food</h2>
        <p className="text-base text-teal-600 dark:text-teal-400">
          Powered by Open Food Facts (free). Packaged foods may show a coloured{' '}
          <strong className="font-semibold">A–E Nutri-Score</strong> — A is the healthiest grade, E
          the least healthy. It is a general food-quality guide; for diabetes, carbs and sugar matter
          most.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. Weetabix, banana..."
            className={`flex-1 ${inputClass}`}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="rounded-xl bg-teal-600 px-5 text-white active:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:active:bg-teal-600"
          >
            <Search size={24} />
          </button>
        </div>

        {results.length > 0 && (
          <ul className="space-y-2 rounded-2xl bg-white p-2 shadow-sm dark:bg-teal-900">
            {results.map((item) => (
              <li key={item.barcode ?? item.name}>
                <button
                  type="button"
                  onClick={() => {
                    applyFood(item);
                    setResults([]);
                    setSearch('');
                  }}
                  className="w-full rounded-xl p-3 text-left hover:bg-teal-50 dark:hover:bg-teal-800"
                >
                  <p className="text-lg font-semibold text-teal-900 dark:text-teal-50">{item.name}</p>
                  <NutritionFactsPanel nutrition={item} compact />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Barcode lookup</h2>
        <p className="text-lg text-teal-700 dark:text-teal-300">
          Point your phone camera at the barcode on the packet
        </p>
        <button
          type="button"
          onClick={() => {
            setError('');
            setScanning(true);
          }}
          disabled={searching}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-teal-600 px-5 py-5 text-xl font-semibold text-white active:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:active:bg-teal-600"
        >
          <Camera size={28} />
          Open camera & scan
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Or type barcode number"
            className={`flex-1 ${inputClass}`}
            onKeyDown={(e) => e.key === 'Enter' && handleBarcode()}
          />
          <button
            type="button"
            onClick={() => {
              if (barcode.trim()) {
                void handleBarcode();
                return;
              }
              setError('');
              setScanning(true);
            }}
            disabled={searching}
            className="rounded-xl bg-teal-600 px-5 text-white active:bg-teal-700 dark:bg-teal-500 dark:active:bg-teal-600"
            aria-label={barcode.trim() ? 'Look up typed barcode' : 'Open camera to scan'}
          >
            <ScanBarcode size={24} />
          </button>
        </div>
      </section>

      {scanning && (
        <BarcodeScanner onScan={handleCameraScan} onClose={() => setScanning(false)} />
      )}

      <section id="add-meal-section" className="space-y-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-teal-900">
        <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-50">Add meal</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What did you eat?"
          className={`w-full ${inputClass}`}
        />

        {hasNutrition(nutrition) ? (
          <div className="rounded-xl border-2 border-teal-100 p-3 dark:border-teal-700">
            <p className="mb-2 text-sm font-semibold text-teal-800 dark:text-teal-200">Nutrition facts</p>
            <NutritionFactsPanel nutrition={nutrition} />
          </div>
        ) : name.trim() ? (
          <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            No nutrition yet — search above or pick a quick-add meal to fill this in automatically.
          </p>
        ) : null}

        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className={`w-full ${inputClass}`}
        />
        {error && <p className="text-lg text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={() =>
            saveMeal({
              ...nutrition,
              name: name.trim(),
              notes: notes.trim() || undefined,
            })
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-5 text-xl font-bold text-white active:bg-teal-700 disabled:opacity-50 dark:bg-teal-500 dark:active:bg-teal-600"
        >
          <Plus size={28} />
          Save meal
        </button>
      </section>
    </div>
  );
}

function FrequentMealButton({
  item,
  saving,
  onSave,
}: {
  item: FrequentMeal;
  saving: boolean;
  onSave: (data: { name: string; time?: string; notes?: string } & Partial<FoodResult>) => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() =>
        onSave({
          name: item.name,
          time: nowTime(),
          notes: item.notes ?? undefined,
          calories: item.calories,
          carbs: item.carbs,
          sugar: item.sugar,
          protein: item.protein,
          fat: item.fat,
          saturatedFat: item.saturatedFat,
          fiber: item.fiber,
          salt: item.salt,
          nutriScore: item.nutriScore,
          servingSize: item.servingSize,
        })
      }
      className="rounded-2xl border-2 border-sky-200 bg-white p-4 text-left active:bg-sky-50 disabled:opacity-60 dark:border-sky-800 dark:bg-teal-900 dark:active:bg-sky-950"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-semibold text-teal-900 dark:text-teal-50">{item.name}</p>
        <History size={18} className="shrink-0 text-sky-500" />
      </div>
      <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">
        Logged {item.freq} time{item.freq !== 1 ? 's' : ''}
        {item.calories != null ? ` · ${item.calories} kcal` : ''}
        {item.carbs != null ? ` · ${item.carbs}g carbs` : ''}
      </p>
    </button>
  );
}

function QuickMealButton({
  item,
  saving,
  onSave,
}: {
  item: QuickMeal;
  saving: boolean;
  onSave: (data: QuickMeal) => void;
}) {
  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => onSave(item)}
      className="rounded-2xl border-2 border-teal-200 bg-white p-4 text-left active:bg-teal-50 disabled:opacity-60 dark:border-teal-700 dark:bg-teal-900 dark:active:bg-teal-800"
    >
      <p className="text-lg font-semibold text-teal-900 dark:text-teal-50">{item.name}</p>
      <p className="mt-1 text-sm text-teal-500 dark:text-teal-500">{item.time}</p>
      <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">
        {item.calories} kcal · {item.carbs}g carbs · {item.protein}g protein
      </p>
      {item.servingSize && (
        <p className="mt-0.5 text-xs text-teal-500 dark:text-teal-500">{item.servingSize}</p>
      )}
    </button>
  );
}
