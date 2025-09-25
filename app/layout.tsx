import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ModeSwitch from "./components/ModeSwitch";
import LangProvider from "./components/LangProvider";
import LangSwitch from "./components/LangSwitch";
import ThemeProvider from "./components/ThemeProvider";
import ThemeToggle from "./components/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "TUM QR",
    template: "%s",
  },
  description: "Kolayca QR kod oluşturun, özelleştirin ve indirin.",
  icons: {
    icon: "/favicon-tumictur.png",
    shortcut: "/favicon-tumictur.png",
    apple: "/favicon-tumictur.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'dark' || (stored !== 'light' && prefersDark) ? 'dark' : 'light';
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  } catch (_) {
    /* no-op */
  }
})();`,
          }}
        />
        <ThemeProvider>
          <LangProvider>
            <header className="sticky top-0 z-40 border-b border-border bg-card backdrop-blur dark:bg-white/5">
              <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-6 py-3">
                <div className="flex items-center gap-3">
                  <Link href="/" className="flex items-center gap-3">
                    <Image
                      src="/tum-ictur-logo.png"
                      alt="TUM ICTUR logo"
                      width={223}
                      height={93}
                      priority
                      className="h-10 w-auto object-contain"
                    />
                    <span className="text-lg font-semibold tracking-tight">QR KOD OLUŞTURUCU</span>
                  </Link>
                </div>
                <div className="justify-self-center">
                  <ModeSwitch />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <ThemeToggle />
                  <LangSwitch />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-6 py-4">{children}</main>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
