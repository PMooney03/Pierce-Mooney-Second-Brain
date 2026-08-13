import { useState } from 'react';
import { LogIn, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import ThemeToggle from './ThemeToggle';

type Mode = 'login' | 'register' | 'forgot';

const inputClass =
  'w-full rounded-xl border-2 border-teal-200 px-4 py-4 text-lg dark:border-teal-700';

export default function AuthScreen() {
  const { login, register, resendVerification } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [resetDevLink, setResetDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await api.forgotPassword(email);
        setInfo(result.message);
        setResetDevLink(result.devLink ?? null);
        return;
      }
      if (mode === 'login') {
        await login(email, password);
      } else {
        const result = await register(email, password, displayName);
        if (result.autoVerified) {
          await login(email, password);
          return;
        }
        setPendingEmail(result.email ?? email);
        setDevLink(result.devLink ?? null);
        setInfo(result.message);
        setMode('login');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      if (message.includes('verify your email')) {
        setPendingEmail(email);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    const target = pendingEmail || email;
    if (!target) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const result = await resendVerification(target);
      setPendingEmail(target);
      setDevLink(result.devLink ?? null);
      setInfo(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-teal-50 dark:bg-teal-950">
      <header className="relative bg-teal-700 px-5 pb-8 pt-8 text-white dark:bg-teal-900">
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          {import.meta.env.DEV && (
            <span className="rounded-lg bg-amber-400 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-950">
              Dev
            </span>
          )}
          <ThemeToggle />
        </div>
        <h1 className="text-3xl font-bold">Diabetes Companion</h1>
        <p className="mt-2 text-lg opacity-90">
          {import.meta.env.DEV
            ? 'DEV playground — sign up works without email'
            : 'Private — verified email required'}
        </p>
      </header>

      <main className="px-4 py-6">
        <div className="mb-6 flex rounded-2xl bg-white p-1 shadow-sm dark:bg-teal-900">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold ${
              mode === 'login' ? 'bg-teal-600 text-white' : 'text-teal-600 dark:text-teal-400'
            }`}
          >
            <LogIn size={20} />
            Log in
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); setInfo(''); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold ${
              mode === 'register' ? 'bg-teal-600 text-white' : 'text-teal-600 dark:text-teal-400'
            }`}
          >
            <UserPlus size={20} />
            Sign up
          </button>
        </div>

        {(info || pendingEmail) && (
          <div className="mb-4 rounded-2xl bg-sky-50 p-4 dark:bg-sky-950">
            {info && <p className="text-lg text-sky-900 dark:text-sky-100">{info}</p>}
            {pendingEmail && (
              <p className="mt-1 text-base text-sky-800 dark:text-sky-200">
                Sent to: <strong>{pendingEmail}</strong>
              </p>
            )}
            {devLink && (
              <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Email is not set up yet — tap this link to activate your account:
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  This is normal until Gmail is configured. You must tap the link before logging in.
                </p>
                <a
                  href={devLink}
                  className="mt-2 block break-all text-base font-semibold text-teal-700 underline dark:text-teal-300"
                >
                  Verify my account
                </a>
              </div>
            )}
            {pendingEmail && (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="mt-3 flex items-center gap-2 text-base font-semibold text-teal-700 dark:text-teal-300"
              >
                <Mail size={18} />
                Resend verification email
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-teal-900">
          {mode === 'forgot' && (
            <p className="text-base text-teal-700 dark:text-teal-300">
              Enter your email and we will send a link to reset your password.
            </p>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">
                Your name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Dad"
                className={inputClass}
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">
              Real email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className={inputClass}
              required
              autoComplete="email"
            />
            {mode === 'register' && (
              <p className="mt-1 text-sm text-teal-600 dark:text-teal-400">
                {import.meta.env.DEV
                  ? 'DEV: no email needed — you will be signed in straight away.'
                  : 'We send a confirmation link — you must verify before logging in.'}
              </p>
            )}
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-teal-700 dark:text-teal-300">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                className={inputClass}
                required
                minLength={mode === 'register' ? 6 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(''); setInfo(''); setResetDevLink(null); }}
              className="text-base font-semibold text-teal-700 dark:text-teal-300"
            >
              Forgot password?
            </button>
          )}

          {resetDevLink && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                No email was sent — tap this link to reset:
              </p>
              <a href={resetDevLink} className="mt-2 block break-all text-base font-semibold text-teal-700 underline dark:text-teal-300">
                Reset my password
              </a>
            </div>
          )}

          {error && <p className="text-lg text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-teal-600 py-5 text-xl font-bold text-white active:bg-teal-700 disabled:opacity-60 dark:bg-teal-500"
          >
            {loading
              ? 'Please wait…'
              : mode === 'login'
                ? 'Log in'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : import.meta.env.DEV
                    ? 'Sign up'
                    : 'Sign up & send verification'}
          </button>

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setInfo(''); setResetDevLink(null); }}
              className="w-full text-base font-semibold text-teal-700 dark:text-teal-300"
            >
              Back to log in
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-teal-600 dark:text-teal-400">
          Only verified users can access the app. Data stays on your family PC.
        </p>
      </main>
    </div>
  );
}
