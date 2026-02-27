"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { XIcon, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in-0 min-w-[320px] max-w-[420px]",
              t.type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
              t.type === "error" && "border-red-200 bg-red-50 text-red-800",
              t.type === "info" && "border-blue-200 bg-blue-50 text-blue-800"
            )}
          >
            {t.type === "success" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
            {t.type === "error" && <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />}
            {t.type === "info" && <Info className="h-5 w-5 shrink-0 text-blue-600" />}
            <span className="flex-1 text-sm font-medium">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
