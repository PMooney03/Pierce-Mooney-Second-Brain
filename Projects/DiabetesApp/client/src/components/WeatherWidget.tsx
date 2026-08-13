import { CloudSun, Droplets, Thermometer } from 'lucide-react';
import { weatherLabel } from '../api';

type Props = {
  temp: number | null;
  code: number | null;
  loading?: boolean;
};

export default function WeatherWidget({ temp, code, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-teal-900">
        <p className="text-lg text-teal-600 dark:text-teal-400">Loading weather...</p>
      </div>
    );
  }

  if (temp === null) return null;

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-50 to-teal-50 p-4 shadow-sm dark:from-sky-950 dark:to-teal-900">
      <CloudSun size={40} className="text-sky-600 dark:text-sky-400" />
      <div className="flex-1">
        <p className="text-lg font-semibold text-teal-900 dark:text-teal-50">{weatherLabel(code ?? 0)}</p>
        <div className="flex gap-4 text-teal-700 dark:text-teal-300">
          <span className="flex items-center gap-1">
            <Thermometer size={18} />
            {Math.round(temp)}°C
          </span>
        </div>
      </div>
      <p className="max-w-[120px] text-sm text-teal-600 dark:text-teal-400">
        <Droplets size={14} className="inline mr-1" />
        Cold or hot days can affect how you feel
      </p>
    </div>
  );
}
