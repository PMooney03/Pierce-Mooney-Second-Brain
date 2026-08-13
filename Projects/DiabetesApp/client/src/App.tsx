import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api, fetchWeather } from './api';
import AuthScreen from './components/AuthScreen';
import VerifyEmailScreen from './components/VerifyEmailScreen';
import ResetPasswordScreen from './components/ResetPasswordScreen';
import BottomNav from './components/BottomNav';
import FoodLogger from './components/FoodLogger';
import HistoryView from './components/HistoryView';
import TodayDashboard from './components/TodayDashboard';
import ThemeToggle from './components/ThemeToggle';
import { useSwipeTabs } from './useSwipeTabs';
import type { MedSlot } from './medUtils';
import type { Meal, MedStatus, Tab } from './types';
import { todayString } from './types';

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [verifyToken, setVerifyToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('verify');
  });
  const [resetToken, setResetToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reset');
  });
  const [tab, setTab] = useState<Tab>('today');
  const [meds, setMeds] = useState<MedStatus>({ morning: null, evening: null, bp: null });
  const [meals, setMeals] = useState<Meal[]>([]);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.getHistory>> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [medLoading, setMedLoading] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const swipeHandlers = useSwipeTabs({ active: tab, onChange: setTab });
  const date = todayString();

  const loadToday = useCallback(async () => {
    const [medData, mealData] = await Promise.all([api.getMeds(date), api.getMeals(date)]);
    setMeds(medData);
    setMeals(mealData);
  }, [date]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getHistory('all');
      setHistory(data);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadToday().catch(console.error);
  }, [user, loadToday]);

  useEffect(() => {
    if (!user || tab !== 'history') return;
    loadHistory().catch(console.error);
  }, [user, tab, loadHistory]);

  useEffect(() => {
    if (!user) return;
    async function loadWeather() {
      setWeatherLoading(true);
      try {
        const saved = await api.getSetting('location');
        let lat = 51.5074;
        let lon = -0.1278;

        if (saved.value) {
          const [sLat, sLon] = saved.value.split(',').map(Number);
          if (!Number.isNaN(sLat) && !Number.isNaN(sLon)) {
            lat = sLat;
            lon = sLon;
          }
        } else if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
          );
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
          await api.setSetting('location', `${lat},${lon}`);
        }

        const w = await fetchWeather(lat, lon);
        setWeather(w);
      } catch {
        setWeather(null);
      } finally {
        setWeatherLoading(false);
      }
    }
    loadWeather();
  }, [user]);

  async function handleToggleMed(slot: MedSlot) {
    setMedLoading(true);
    try {
      await api.toggleMed(date, slot);
      await loadToday();
    } finally {
      setMedLoading(false);
    }
  }

  async function handleDeleteMeal(id: number) {
    await api.deleteMeal(id);
    await loadToday();
  }

  async function handleEditMeal(meal: Meal) {
    const { id, ...fields } = meal;
    await api.updateMeal(id, fields);
    await loadToday();
  }

  function handleLogout() {
    window.history.replaceState({}, '', window.location.pathname);
    setVerifyToken(null);
    setResetToken(null);
    logout();
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-teal-50 dark:bg-teal-950">
        <p className="text-xl text-teal-700 dark:text-teal-300">Loading…</p>
      </div>
    );
  }

  if (resetToken) {
    return (
      <ResetPasswordScreen
        token={resetToken}
        onDone={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setResetToken(null);
        }}
      />
    );
  }

  if (verifyToken) {
    return (
      <VerifyEmailScreen
        token={verifyToken}
        onDone={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setVerifyToken(null);
        }}
      />
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-teal-50 pb-24 dark:bg-teal-950">
      <header className="relative bg-teal-700 px-5 pb-6 pt-8 text-white dark:bg-teal-900">
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          {import.meta.env.DEV && (
            <span className="rounded-lg bg-amber-400 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
              Dev
            </span>
          )}
          <ThemeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:bg-white/40"
            aria-label="Log out"
          >
            <LogOut size={22} />
          </button>
        </div>
        <p className="text-lg opacity-90">{greeting}, {user.displayName}</p>
        <h1 className="text-3xl font-bold">Diabetes Companion</h1>
        <p className="mt-1 text-lg opacity-90">
          {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      <main className="space-y-6 px-4 pt-5 touch-pan-y" {...swipeHandlers}>
        {tab === 'today' && (
          <TodayDashboard
            meds={meds}
            meals={meals}
            weather={weather}
            weatherLoading={weatherLoading}
            medLoading={medLoading}
            onToggleMed={handleToggleMed}
            onDeleteMeal={handleDeleteMeal}
            onEditMeal={handleEditMeal}
            onLogFood={() => setTab('food')}
          />
        )}

        {tab === 'food' && <FoodLogger onAdded={loadToday} />}

        {tab === 'history' && <HistoryView data={history} loading={historyLoading} />}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
