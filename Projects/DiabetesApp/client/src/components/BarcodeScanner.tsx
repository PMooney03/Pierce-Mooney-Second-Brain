import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { X, Camera } from 'lucide-react';

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  onScanRef.current = onScan;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!window.isSecureContext) {
      setError('Camera needs a secure (https) connection. Open the Tailscale https link, then try again.');
      setStarting(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera. Type the barcode instead.');
      setStarting(false);
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video!,
          (result, _err, controls) => {
            if (!result || handledRef.current || cancelled) return;
            handledRef.current = true;
            controls.stop();
            onScanRef.current(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
            ? 'Camera permission denied — allow camera access in the browser, then try again. Or type the barcode below.'
            : e instanceof DOMException && e.name === 'NotFoundError'
              ? 'No camera found on this device — type the barcode instead.'
              : 'Could not start the camera — try typing the barcode instead.';
        setError(message);
        setStarting(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-3 bg-teal-900 px-4 py-4 text-white">
        <div className="flex items-center gap-2">
          <Camera size={24} />
          <h2 className="text-xl font-bold">Scan barcode</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-teal-800 p-3 active:bg-teal-700"
          aria-label="Close scanner"
        >
          <X size={28} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        {!error && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="h-40 w-[85%] max-w-md rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            <p className="mt-6 rounded-full bg-black/60 px-4 py-2 text-center text-lg text-white">
              {starting ? 'Starting camera…' : 'Line up the barcode in the box'}
            </p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <div className="max-w-sm space-y-4 text-center">
              <p className="text-lg text-white">{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-teal-600 px-6 py-3 text-lg font-semibold text-white active:bg-teal-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
