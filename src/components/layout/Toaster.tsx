"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useToasts } from "@/stores/toast-store";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            initial={{ y: -60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
            onClick={() => dismiss(toast.id)}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left shadow-xl cursor-pointer"
          >
            {toast.icon && <span className="text-3xl">{toast.icon}</span>}
            <span>
              <span className="block text-sm font-extrabold">{toast.title}</span>
              {toast.description && (
                <span className="block text-xs font-semibold text-muted-foreground">
                  {toast.description}
                </span>
              )}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
