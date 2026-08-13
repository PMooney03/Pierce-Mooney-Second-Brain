import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../api';
import ThemeToggle from './ThemeToggle';

const inputClass =
  'w-full rounded-xl border-2 border-teal-200 px-4 py-4 text-lg dark:border-teal-700';

type Props = {
  token: string;
  onDone: () => void;
};

export default function ResetPasswordScreen({ token, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.resetPassword(token, password);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-teal-50 dark:bg-teal-950">
      <header className="relative bg-teal-700 px-5 pb-8 pt-8 text-white dark:bg-teal-900">
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        <h1 className="text-3xl font-bold">New password</h1>
      </header>

      <main className="px-4 py-6">
        {message ? (
          <div className="rounded-2xl bg-emerald-50 p-5 dark:bg-emerald-950">
            <p className="text-lg text-emerald-900 dark:text-emerald-100">{message}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-4 w-full rounded-2xl bg-teal-600 py-4 text-xl font-bold text-white dark:bg-teal-500"
            >
              Go to log in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-teal-900">
            <p className="text-base text-teal-700 dark:text-teal-300">Choose a new password for your account.</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                minLength={6}
                required
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-lg text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-5 text-xl font-bold text-white disabled:opacity-60 dark:bg-teal-500"
            >
              <KeyRound size={24} />
              {loading ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
