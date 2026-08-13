import { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';

type Props = {
  token: string;
  onDone: () => void;
};

export default function VerifyEmailScreen({ token, onDone }: Props) {
  const { verifyEmail } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Email verified! You can log in now.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [token, verifyEmail]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-teal-50 px-4 dark:bg-teal-950">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm dark:bg-teal-900">
        {status === 'loading' && (
          <p className="text-xl text-teal-700 dark:text-teal-300">Confirming your email…</p>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
            <p className="text-xl font-semibold text-teal-900 dark:text-teal-50">{message}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-6 w-full rounded-2xl bg-teal-600 py-4 text-lg font-bold text-white"
            >
              Go to log in
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <p className="text-xl text-red-600 dark:text-red-400">{message}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-6 w-full rounded-2xl bg-teal-600 py-4 text-lg font-bold text-white"
            >
              Back to log in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
