"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { Toast, ToastTitle, ToastDescription } from "./toast";
import { useToast } from "./use-toast";

function Toaster() {
  const { toasts, dismiss } = useToast();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "animate-in slide-in-from-bottom-full fade-in-0 duration-300",
          )}
        >
          <Toast variant={t.variant} onDismiss={() => dismiss(t.id)}>
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && (
              <ToastDescription>{t.description}</ToastDescription>
            )}
            {t.action}
          </Toast>
        </div>
      ))}
    </div>,
    document.body
  );
}

export { Toaster };
