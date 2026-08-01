import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast-provider";

export const metadata: Metadata = {
  title: "Plabin Task Management",
  description: "ระบบจัดการงานทีม Plabin ด้วย Next.js และ Supabase",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
