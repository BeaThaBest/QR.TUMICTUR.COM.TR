"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MODES = [
  { href: "/qr-lite", label: "Lite Mode" },
  { href: "/full-mode", label: "Full Mode" },
];

export default function ModeSwitch() {
  const pathname = usePathname() || "";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm dark:bg-white/10">
      {MODES.map(mode => {
        const active = pathname === mode.href || pathname.startsWith(`${mode.href}/`);
        return (
          <Link
            key={mode.href}
            href={mode.href}
            className={`px-4 py-2 rounded-full text-sm font-medium ${active ? `!bg-primary !text-white shadow-sm` : "text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
            aria-current={active ? "page" : undefined}
          >
            {mode.label}
          </Link>
        );
      })}
    </div>
  );
}
