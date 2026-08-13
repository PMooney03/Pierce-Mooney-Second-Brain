import type { HistoryData, Meal } from './types';
import { localDateString } from './types';
import { countTabletsTaken, TABLET_COUNT } from './medUtils';

export type DaySummary = {
  date: string;
  morningTaken: boolean;
  eveningTaken: boolean;
  bpTaken: boolean;
  morningTime: string | null;
  eveningTime: string | null;
  bpTime: string | null;
  meals: Meal[];
  mealCount: number;
  totalCalories: number;
  totalCarbs: number;
};

export type BiweeklyPeriod = {
  id: string;
  startDate: string;
  endDate: string;
  label: string;
  days: DaySummary[];
  tabletsTaken: number;
  tabletsExpected: number;
  mealsLogged: number;
  totalCalories: number;
  totalCarbs: number;
};

export type WeekSummary = {
  startDate: string;
  endDate: string;
  days: DaySummary[];
  tabletsTaken: number;
  tabletsExpected: number;
  mealsLogged: number;
  totalCalories: number;
  totalCarbs: number;
  avgCarbs: number;
  avgCalories: number;
  daysWithMissedTablets: number;
};

export function buildDays(data: HistoryData): string[] {
  const dates = new Set([
    ...data.meds.map((m) => m.date),
    ...data.meals.map((m) => m.date),
  ]);
  return [...dates].sort().reverse();
}

export function summarizeDay(data: HistoryData, date: string): DaySummary {
  const dayMeds = data.meds.filter((m) => m.date === date);
  const morning = dayMeds.find((m) => m.slot === 'morning');
  const evening = dayMeds.find((m) => m.slot === 'evening');
  const bp = dayMeds.find((m) => m.slot === 'bp');
  const dayMeals = data.meals.filter((m) => m.date === date);

  return {
    date,
    morningTaken: !!morning,
    eveningTaken: !!evening,
    bpTaken: !!bp,
    morningTime: morning?.taken_at ?? null,
    eveningTime: evening?.taken_at ?? null,
    bpTime: bp?.taken_at ?? null,
    meals: dayMeals,
    mealCount: dayMeals.length,
    totalCalories: dayMeals.reduce((s, m) => s + (m.calories ?? 0), 0),
    totalCarbs: dayMeals.reduce((s, m) => s + (m.carbs ?? 0), 0),
  };
}

export function formatRange(start: string, end: string) {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${s.toLocaleDateString([], opts)} – ${e.toLocaleDateString([], { ...opts, year: 'numeric' })}`;
}

export function groupBiweekly(data: HistoryData): BiweeklyPeriod[] {
  const allDates = buildDays(data);
  if (allDates.length === 0) return [];

  const periods: BiweeklyPeriod[] = [];
  const newest = allDates[0];
  const oldest = allDates[allDates.length - 1];

  let periodEnd = new Date(newest + 'T12:00:00');

  while (periodEnd >= new Date(oldest + 'T12:00:00')) {
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 13);

    const startStr = localDateString(periodStart);
    const endStr = localDateString(periodEnd);

    const daysInPeriod: DaySummary[] = [];
    for (let d = new Date(periodEnd); d >= periodStart; d.setDate(d.getDate() - 1)) {
      const dateStr = localDateString(d);
      const hasData =
        data.meds.some((m) => m.date === dateStr) || data.meals.some((m) => m.date === dateStr);
      if (hasData) {
        daysInPeriod.push(summarizeDay(data, dateStr));
      }
    }

    if (daysInPeriod.length > 0) {
      const tabletsTaken = daysInPeriod.reduce(
        (s, d) => s + countTabletsTaken({ morning: d.morningTaken, evening: d.eveningTaken, bp: d.bpTaken }),
        0,
      );
      periods.push({
        id: `${startStr}_${endStr}`,
        startDate: startStr,
        endDate: endStr,
        label: formatRange(startStr, endStr),
        days: daysInPeriod,
        tabletsTaken,
        tabletsExpected: daysInPeriod.length * TABLET_COUNT,
        mealsLogged: daysInPeriod.reduce((s, d) => s + d.mealCount, 0),
        totalCalories: daysInPeriod.reduce((s, d) => s + d.totalCalories, 0),
        totalCarbs: daysInPeriod.reduce((s, d) => s + d.totalCarbs, 0),
      });
    }

    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() - 1);
  }

  return periods;
}

export function buildWeekSummary(data: HistoryData, now = new Date()): WeekSummary {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const days: DaySummary[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = localDateString(d);
    days.push(summarizeDay(data, dateStr));
  }

  const startDate = days[0].date;
  const endDate = days[days.length - 1].date;
  const tabletsTaken = days.reduce(
    (s, day) => s + countTabletsTaken({ morning: day.morningTaken, evening: day.eveningTaken, bp: day.bpTaken }),
    0,
  );
  const mealsLogged = days.reduce((s, day) => s + day.mealCount, 0);
  const totalCalories = days.reduce((s, day) => s + day.totalCalories, 0);
  const totalCarbs = days.reduce((s, day) => s + day.totalCarbs, 0);
  const daysWithData = days.filter(
    (d) => d.mealCount > 0 || d.morningTaken || d.eveningTaken || d.bpTaken,
  ).length;
  const daysWithMissedTablets = days.filter(
    (d) => !d.morningTaken || !d.eveningTaken || !d.bpTaken,
  ).length;

  return {
    startDate,
    endDate,
    days: [...days].reverse(),
    tabletsTaken,
    tabletsExpected: days.length * TABLET_COUNT,
    mealsLogged,
    totalCalories,
    totalCarbs,
    avgCarbs: daysWithData > 0 ? Math.round(totalCarbs / daysWithData) : 0,
    avgCalories: daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0,
    daysWithMissedTablets,
  };
}

export function summarizeTodayMeals(meals: Meal[]) {
  return {
    count: meals.length,
    calories: meals.reduce((s, m) => s + (m.calories ?? 0), 0),
    carbs: meals.reduce((s, m) => s + (m.carbs ?? 0), 0),
    protein: meals.reduce((s, m) => s + (m.protein ?? 0), 0),
  };
}
