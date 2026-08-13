const NUTRIMENT_KEYS = {
  calories: ['energy-kcal_100g', 'energy-kcal', 'energy-kcal_serving', 'energy-kcal_value'],
  carbs: ['carbohydrates_100g', 'carbohydrates', 'carbohydrates_serving', 'carbohydrates_value'],
  sugar: ['sugars_100g', 'sugars', 'sugars_serving', 'sugars_value'],
  fat: ['fat_100g', 'fat', 'fat_serving', 'fat_value'],
  saturatedFat: ['saturated-fat_100g', 'saturated-fat', 'saturated-fat_serving', 'saturated-fat_value'],
  protein: ['proteins_100g', 'proteins', 'proteins_serving', 'proteins_value'],
  fiber: ['fiber_100g', 'fiber', 'fiber_serving', 'fiber_value'],
  salt: ['salt_100g', 'salt', 'salt_serving', 'salt_value'],
};

function roundNutrient(val) {
  return Math.round(Number(val) * 10) / 10;
}

function pickNutriment(n, keys) {
  for (const key of keys) {
    const val = n[key];
    if (val != null && val !== '' && !Number.isNaN(Number(val))) {
      return roundNutrient(val);
    }
  }
  return null;
}

function pickCalories(n) {
  const kcal = pickNutriment(n, NUTRIMENT_KEYS.calories);
  if (kcal != null) return kcal;
  const kj = pickNutriment(n, ['energy_100g', 'energy', 'energy-kj_100g', 'energy-kj']);
  if (kj != null) return roundNutrient(kj / 4.184);
  return null;
}

export function parseNutrition(product) {
  const n = product.nutriments ?? {};

  return {
    calories: pickCalories(n),
    carbs: pickNutriment(n, NUTRIMENT_KEYS.carbs),
    sugar: pickNutriment(n, NUTRIMENT_KEYS.sugar),
    fat: pickNutriment(n, NUTRIMENT_KEYS.fat),
    saturatedFat: pickNutriment(n, NUTRIMENT_KEYS.saturatedFat),
    protein: pickNutriment(n, NUTRIMENT_KEYS.protein),
    fiber: pickNutriment(n, NUTRIMENT_KEYS.fiber),
    salt: pickNutriment(n, NUTRIMENT_KEYS.salt),
    nutriScore: product.nutrition_grades?.toUpperCase() ?? product.nutriscore_grade?.toUpperCase() ?? null,
    servingSize: product.serving_size ?? null,
    per: '100g',
  };
}

export function parseFoodProduct(product, barcode) {
  const nutrition = parseNutrition(product);
  return {
    name: product.product_name || 'Unknown',
    barcode: barcode ?? product.code ?? null,
    ...nutrition,
  };
}

export function hasNutrition(nutrition) {
  return Object.entries(nutrition).some(
    ([key, val]) => !['nutriScore', 'servingSize', 'per'].includes(key) && val != null,
  );
}
