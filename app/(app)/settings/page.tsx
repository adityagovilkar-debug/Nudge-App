"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Moon,
  Sun,
  Type,
  Mail,
  Tags,
  LogOut,
  User,
  Check,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import {
  getTheme,
  getTextSize,
  setTheme,
  setTextSize,
  type TextSize,
  type Theme,
} from "@/lib/theme";
import { CategoryManager } from "@/components/CategoryManager";
import { NotificationToggle } from "@/components/NotificationToggle";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-lg py-2.5 text-base font-semibold transition",
            value === o.value ? "bg-surface text-text shadow-sm" : "text-text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        "relative h-8 w-14 shrink-0 rounded-full transition",
        on ? "bg-brand-600" : "bg-surface-2 border border-border",
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all",
          on ? "left-7" : "left-1",
        )}
      />
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sun;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Icon className="h-5 w-5 text-brand-600 dark:text-brand-300" /> {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [theme, setThemeState] = useState<Theme>("light");
  const [textSize, setTextSizeState] = useState<TextSize>("normal");
  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
    setTextSizeState(getTextSize());
  }, []);

  useEffect(() => {
    if (profile && !nameDirty) setName(profile.full_name ?? "");
  }, [profile, nameDirty]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function saveName() {
    if (!name.trim()) return;
    updateProfile.mutate(
      { full_name: name.trim() },
      {
        onSuccess: () => {
          setNameDirty(false);
          toast.success("Name updated");
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      {/* Appearance */}
      <Section icon={Type} title="Appearance">
        <div className="space-y-5">
          <div>
            <p className="label flex items-center gap-1.5">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              Theme
            </p>
            <Segmented<Theme>
              value={theme}
              onChange={(v) => {
                setTheme(v);
                setThemeState(v);
              }}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <div>
            <p className="label">Text size</p>
            <Segmented<TextSize>
              value={textSize}
              onChange={(v) => {
                setTextSize(v);
                setTextSizeState(v);
              }}
              options={[
                { value: "normal", label: "Normal" },
                { value: "large", label: "Large" },
                { value: "xlarge", label: "Extra large" },
              ]}
            />
            <p className="mt-2 text-sm text-text-muted">
              Make everything bigger and easier to read.
            </p>
          </div>
        </div>
      </Section>

      {/* Reminders */}
      <Section icon={Mail} title="Email reminders">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-medium">Morning reminder email</p>
            <p className="mt-1 text-sm text-text-muted">
              Each morning we&apos;ll email you what&apos;s due that day (and anything
              overdue){profile?.email ? ` to ${profile.email}` : ""}.
            </p>
          </div>
          <Toggle
            label="Morning reminder email"
            on={profile?.email_reminders ?? false}
            onChange={(v) =>
              updateProfile.mutate(
                { email_reminders: v },
                { onSuccess: () => toast.success(v ? "Reminders on" : "Reminders off") },
              )
            }
          />
        </div>
      </Section>

      {/* Phone notifications */}
      <Section icon={Bell} title="Phone notifications">
        <NotificationToggle />
      </Section>

      {/* Categories */}
      <Section icon={Tags} title="Categories">
        <CategoryManager />
      </Section>

      {/* Account */}
      <Section icon={User} title="Account">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <div className="flex gap-2">
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameDirty(true);
                }}
                placeholder="Your name"
              />
              {nameDirty && (
                <button className="btn-primary shrink-0" onClick={saveName}>
                  <Check className="h-5 w-5" /> Save
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Signed in as <b className="text-text">{profile?.email}</b>
          </p>
          <button className="btn-outline w-full text-rose-600" onClick={signOut}>
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </div>
      </Section>

      <p className="pb-4 text-center text-sm text-text-muted">
        {APP_NAME} · your private errands &amp; reminders
      </p>
    </div>
  );
}
