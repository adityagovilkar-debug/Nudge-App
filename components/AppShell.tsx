"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, CalendarDays, CheckCircle2, Settings, Plus, GlassWater } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrandDialog } from "./ErrandDialog";
import { ERRAND_DIALOG_EVENT, openErrandDialog, type ErrandDialogDetail } from "@/lib/events";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { Errand } from "@/lib/types";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/upcoming", label: "Upcoming", icon: CalendarDays },
  { href: "/done", label: "Done", icon: CheckCircle2 },
  { href: "/water", label: "Water", icon: GlassWater },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Errand | undefined>(undefined);

  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  // Open the shared dialog from anywhere via a window event.
  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent<ErrandDialogDetail>).detail;
      setEditing(detail?.errand);
      setDialogOpen(true);
    }
    window.addEventListener(ERRAND_DIALOG_EVENT, onOpen);
    return () => window.removeEventListener(ERRAND_DIALOG_EVENT, onOpen);
  }, []);

  // Keep the user's timezone current so the morning email uses their local day.
  useEffect(() => {
    if (!profile) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== profile.timezone) {
      updateProfile.mutate({ timezone: tz });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-xl font-bold tracking-tight">{APP_NAME}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.filter((n) => n.href !== "/settings").map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-base font-medium transition",
                  isActive(n.href)
                    ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
                    : "text-text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => openErrandDialog()}
              className="btn-primary hidden sm:inline-flex"
            >
              <Plus className="h-5 w-5" /> New errand
            </button>
            <Link
              href="/settings"
              aria-label="Settings"
              className={cn(
                "hidden rounded-lg p-2.5 sm:inline-flex",
                isActive("/settings")
                  ? "bg-brand-500/10 text-brand-700 dark:text-brand-300"
                  : "text-text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 pb-28 pt-5 sm:pb-10">{children}</main>

      {/* Floating Add button */}
      <button
        onClick={() => openErrandDialog()}
        aria-label="New errand"
        className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-90 hover:bg-brand-700 sm:bottom-8"
      >
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      </button>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {NAV.map((n) => {
            const active = isActive(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition",
                  active ? "text-brand-600 dark:text-brand-300" : "text-text-muted",
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-brand-600 dark:bg-brand-400" />
                )}
                <Icon className="h-6 w-6" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <ErrandDialog
        open={dialogOpen}
        errand={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(undefined);
        }}
      />
    </div>
  );
}
