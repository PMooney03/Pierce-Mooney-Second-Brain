import { useRef, type PointerEvent } from 'react';
import type { Tab } from './types';

const TABS: Tab[] = ['today', 'food', 'history'];
const SWIPE_THRESHOLD_PX = 55;
const DIRECTION_LOCK_PX = 10;

type Options = {
  active: Tab;
  onChange: (tab: Tab) => void;
  enabled?: boolean;
};

type Gesture = {
  x: number;
  y: number;
  pointerId: number;
  pointerType: string;
  axis: 'x' | 'y' | null;
  captured: boolean;
};

/**
 * Sideways swipe changes tabs. Clicks on buttons / inputs still work —
 * we only capture the pointer after a clear horizontal drag starts.
 */
export function useSwipeTabs({ active, onChange, enabled = true }: Options) {
  const gestureRef = useRef<Gesture | null>(null);

  function shouldIgnoreTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    return Boolean(
      el?.closest(
        'input, textarea, select, button, a, label, [role="button"], [role="dialog"], [data-no-swipe]',
      ),
    );
  }

  function onPointerDown(e: PointerEvent) {
    if (!enabled || e.button !== 0) return;
    if (shouldIgnoreTarget(e.target)) {
      gestureRef.current = null;
      return;
    }

    gestureRef.current = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      axis: null,
      captured: false,
    };
  }

  function onPointerMove(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;

    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;

    if (g.axis == null && (Math.abs(dx) > DIRECTION_LOCK_PX || Math.abs(dy) > DIRECTION_LOCK_PX)) {
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // Only capture once we know it's a horizontal tab swipe (keeps buttons clickable)
      if (g.axis === 'x' && !g.captured) {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        g.captured = true;
      }
    }
  }

  function finish(e: PointerEvent) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;

    if (g.captured) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* already released */
      }
    }

    if (!enabled || g.axis !== 'x') return;

    const dx = e.clientX - g.x;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;

    const index = TABS.indexOf(active);
    if (index < 0) return;

    if (dx < 0 && index < TABS.length - 1) {
      onChange(TABS[index + 1]);
    } else if (dx > 0 && index > 0) {
      onChange(TABS[index - 1]);
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
