"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { Surface } from "@avenick/ui";

type Variant = "success" | "error" | "info";
type Toast = { id: number; title: string; description?: string; variant: Variant };

const ToastContext = React.createContext<{ toast: (t: { title: string; description?: string; variant?: Variant }) => void }>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

const ICON: Record<Variant, React.ElementType> = { success: CheckCircle2, error: AlertCircle, info: Info };
/** The ink token, not the fill token: this is 16px text-scale iconography. */
const COLOR: Record<Variant, string> = {
  success: "text-success-ink",
  error: "text-danger-ink",
  info: "text-accent-ink",
};

/** Long enough to read two lines, short enough not to become furniture. */
const DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  /**
   * Timers live in a ref rather than in a closure so the stack can be PAUSED.
   * A toast that vanishes on a fixed timer while the reader is still on it fails
   * WCAG 2.2.1; hovering or focusing the stack now holds every pending toast
   * open, and leaving it restarts them from a full interval.
   */
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((p) => p.filter((x) => x.id !== id));
  }, []);

  const schedule = React.useCallback((id: number) => {
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => dismiss(id), DISMISS_MS));
  }, [dismiss]);

  const toast = React.useCallback((t: { title: string; description?: string; variant?: Variant }) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, title: t.title, description: t.description, variant: t.variant ?? "success" }]);
    schedule(id);
  }, [schedule]);

  // Nothing may be left running after the provider goes away.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toast }), [toast]);

  function holdAll() {
    timers.current.forEach((timer) => clearTimeout(timer));
  }

  function releaseAll() {
    toasts.forEach((t) => schedule(t.id));
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        aria-live is the whole point of a toast for a screen-reader user, and it
        was missing: every confirmation in this portal was announced to nobody.
        The region is always mounted so the announcement fires when a child is
        inserted, rather than when the region itself appears.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-relevant="additions"
        // role="status" carries an implicit aria-atomic="true", which makes a
        // screen reader re-read the WHOLE stack every time one toast is added.
        // Only the new node should be announced.
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 end-4 flex w-[calc(100%-2rem)] flex-col gap-2 sm:w-80"
        // Above <Layer> (panel z-51), because a toast fired from inside a drawer
        // or a modal has to be readable without closing the thing that raised it.
        style={{ zIndex: 60 }}
      >
        {toasts.map((t) => {
          const Icon = ICON[t.variant];
          return (
            // Rung 4 and deliberately opaque. A toast is a floating layer, so
            // blur would be permitted here — but several can stack at once, the
            // seller portal's whole budget is two blurred surfaces per viewport,
            // and every one of these carries a sentence somebody has to read.
            <Surface
              key={t.id}
              rung={4}
              className="pointer-events-auto flex animate-fade-up items-start gap-2.5 p-3.5"
              onMouseEnter={holdAll}
              onMouseLeave={releaseAll}
              onFocus={holdAll}
              onBlur={releaseAll}
            >
              {/* h-4 w-4, because the old h-4.5/w-4.5 are not classes Tailwind
                  generates — the icon was silently rendering at lucide's 24px
                  default and knocking the two text lines out of alignment. */}
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLOR[t.variant]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="u-ui font-medium text-ink-1">{t.title}</p>
                {t.description && <p className="u-meta mt-0.5 text-ink-2">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="u-focus -me-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-nested text-ink-3 transition-colors duration-press ease-standard hover:bg-ink-1/[0.06] hover:text-ink-1"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Surface>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
