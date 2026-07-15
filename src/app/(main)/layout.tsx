"use client";

import {
  AwardIcon,
  BarChart3Icon,
  GraduationCapIcon,
  HomeIcon,
  MapIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/layout/Toaster";
import { levelForXp } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useProgress } from "@/stores/progress-store";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: HomeIcon },
  { href: "/play", label: "Entrenar", icon: PlayIcon },
  { href: "/exam", label: "Examen", icon: GraduationCapIcon },
  { href: "/map", label: "Mapa", icon: MapIcon },
  { href: "/stats", label: "Progreso", icon: BarChart3Icon },
  { href: "/achievements", label: "Logros", icon: AwardIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { xp, streakCurrent } = useProgress();
  const level = levelForXp(xp);

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Toaster />

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r-2 bg-card p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="text-3xl">🚕</span>
          <span className="text-lg font-black tracking-tight">
            TaxiTrainer <span className="text-primary">AI</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 border-transparent px-3 py-2.5 text-sm font-bold transition-colors",
                  active
                    ? "border-primary/40 bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border-2 bg-background p-3 text-sm font-bold">
          <div className="flex items-center justify-between">
            <span>🔥 {streakCurrent}</span>
            <span>⚡ {xp} XP</span>
          </div>
          <div className="mt-1 text-xs font-semibold text-muted-foreground">
            Nivel {level}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b-2 bg-card px-4 py-2 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-1.5">
          <span className="text-2xl">🚕</span>
          <span className="font-black">
            TaxiTrainer <span className="text-primary">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span>🔥 {streakCurrent}</span>
          <span>⚡ {xp}</span>
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            Nv {level}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="min-h-0 flex-1 overflow-auto pb-16 md:pb-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t-2 bg-card py-1.5 md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[10px] font-bold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
