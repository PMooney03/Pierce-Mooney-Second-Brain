export type NutritionFacts = {
  calories: number | null;
  carbs: number | null;
  sugar: number | null;
  fat: number | null;
  saturatedFat: number | null;
  protein: number | null;
  fiber: number | null;
  salt: number | null;
  nutriScore: string | null;
  servingSize: string | null;
  per?: string;
};

export type MedStatus = {
  morning: string | null;
  evening: string | null;
  bp: string | null;
};

export type Meal = {
  id: number;
  date: string;
  time: string;
  name: string;
  carbs: number | null;
  sugar: number | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  saturated_fat: number | null;
  fiber: number | null;
  salt: number | null;
  nutri_score: string | null;
  serving_size: string | null;
  notes: string | null;
};

export type FoodResult = NutritionFacts & {
  name: string;
  barcode?: string | null;
};

export type FrequentMeal = FoodResult & {
  freq: number;
  last_date: string;
  time: string;
  notes?: string | null;
};

export type Tab = 'today' | 'food' | 'history';

/** Local calendar date YYYY-MM-DD (not UTC — fixes wrong "today" in UK/IE evenings & after midnight). */
export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString() {
  return localDateString();
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: string) {
  const d = new Date(date + 'T12:00:00');
  const today = todayString();
  if (date === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localDateString(yesterday)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateLong(date: string) {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function mealToNutrition(meal: Partial<Meal>): NutritionFacts {
  const per =
    meal.serving_size && !meal.serving_size.includes('100g') ? 'serving' : '100g';
  return {
    calories: meal.calories ?? null,
    carbs: meal.carbs ?? null,
    sugar: meal.sugar ?? null,
    fat: meal.fat ?? null,
    saturatedFat: meal.saturated_fat ?? null,
    protein: meal.protein ?? null,
    fiber: meal.fiber ?? null,
    salt: meal.salt ?? null,
    nutriScore: meal.nutri_score ?? null,
    servingSize: meal.serving_size ?? null,
    per,
  };
}

export function nutritionToMealFields(n: Partial<NutritionFacts & FoodResult>) {
  return {
    calories: n.calories ?? null,
    carbs: n.carbs ?? null,
    sugar: n.sugar ?? null,
    protein: n.protein ?? null,
    fat: n.fat ?? null,
    saturated_fat: n.saturatedFat ?? null,
    fiber: n.fiber ?? null,
    salt: n.salt ?? null,
    nutri_score: n.nutriScore ?? null,
    serving_size: n.servingSize ?? null,
  };
}

export function hasNutrition(n: NutritionFacts) {
  return [n.calories, n.carbs, n.sugar, n.fat, n.protein, n.fiber, n.salt].some((v) => v != null);
}

export type HistoryMed = {
  date: string;
  slot: string;
  taken_at: string;
};

export type HistoryData = {
  meds: HistoryMed[];
  meals: Meal[];
};
