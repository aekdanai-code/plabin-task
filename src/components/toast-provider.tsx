"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return <Toaster richColors position="top-center" toastOptions={{ style: { borderRadius: 16 } }} />;
}
