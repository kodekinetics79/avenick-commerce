"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Variant = "success" | "error" | "info";
type Toast = { id: number; title: string; description?: string; variant: Variant };

const ToastContext = React.createContext<{ toast: (t: { title: string; description?: string; variant?: Variant }) => void }>({
  toast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

const ICON: Record<Variant, React.ElementType> = { success: CheckCircle2, error: AlertCircle, info: Info };
const COLOR: Record<Variant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const toast = React.useCallback((t: { title: string; description?: string; variant?: Variant }) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, title: t.title, description: t.description, variant: t.variant ?? "success" }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismiss = (id: number) => setToasts((p) => p.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 end-4 z-[120] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-80 pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICON[t.variant];
          return (
            <div key={t.id} className="pointer-events-auto glass-strong rounded-xl border border-border shadow-elevated p-3.5 flex items-start gap-2.5 animate-fade-up">
              <Icon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${COLOR[t.variant]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
