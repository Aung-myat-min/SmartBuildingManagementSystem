"use client";

import {
  Bell,
  KeyRound,
  Laptop,
  Lock,
  Palette,
  SlidersHorizontal,
  Smartphone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/lib/app-state";
import { formatRelative } from "@/lib/format";
import { BUILDINGS } from "@/lib/mock-data";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type SectionId =
  | "profile"
  | "appearance"
  | "notifications"
  | "monitoring"
  | "security";

const SECTIONS: {
  id: SectionId;
  label: string;
  icon: typeof UserRound;
  ceoOnly?: boolean;
}[] = [
  { id: "profile", label: "Your account", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  {
    id: "monitoring",
    label: "Monitoring",
    icon: SlidersHorizontal,
    ceoOnly: true,
  },
  { id: "security", label: "Password & sessions", icon: KeyRound },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SettingsPage() {
  const { currentUser, role, setRole, activeBuildingId } = useAppState();
  const [section, setSection] = React.useState<SectionId>("profile");

  const scopeValue =
    role === "office-staff"
      ? (BUILDINGS.find((b) => b.id === activeBuildingId)?.name ?? "—")
      : "All buildings";

  return (
    <div className="grid grid-cols-[216px_minmax(0,1fr)] items-start gap-4 max-lg:grid-cols-1">
      <Card className="gap-0 overflow-hidden p-0 max-lg:hidden">
        {SECTIONS.map((s) => {
          const active = s.id === section;
          const locked = s.ceoOnly && role !== "ceo-super-admin";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "border-border/60 flex w-full items-center gap-2.5 border-b border-l-[3px] px-3.5 py-2.75 text-left last:border-b-0",
                active
                  ? "bg-accent/50 border-l-primary"
                  : "hover:bg-surface-hover border-l-transparent",
              )}
            >
              <s.icon
                className={cn(
                  "size-3.5 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "flex-1 text-[12px] font-[450]",
                  active ? "text-foreground" : "text-foreground/80",
                )}
              >
                {s.label}
              </span>
              {locked && (
                <Lock className="text-muted-foreground size-3 shrink-0" />
              )}
            </button>
          );
        })}
      </Card>

      <div className="flex gap-1.5 overflow-x-auto lg:hidden">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap",
              s.id === section
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground/70",
            )}
          >
            <s.icon className="size-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        {section === "profile" && (
          <ProfileSection
            name={currentUser.name}
            email={currentUser.email}
            role={role}
            scopeValue={scopeValue}
          />
        )}
        {section === "appearance" && <AppearanceSection />}
        {section === "notifications" && <NotificationsSection />}
        {section === "monitoring" &&
          (role === "ceo-super-admin" ? (
            <MonitoringSection />
          ) : (
            <MonitoringLocked
              currentRoleLabel={roleLabel[role]}
              onSwitch={() => setRole("ceo-super-admin")}
            />
          ))}
        {section === "security" && <SecuritySection />}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  detail,
  children,
  className,
}: {
  title: string;
  detail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 p-4.5 lg:p-5", className)}>
      <div className="text-[13.5px] font-semibold">{title}</div>
      {detail && (
        <p className="text-muted-foreground mt-1.5 text-[11.5px] leading-relaxed">
          {detail}
        </p>
      )}
      <div className="mt-4.5">{children}</div>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
      {children}
    </span>
  );
}

// ---- Profile -----------------------------------------------------------

function ProfileSection({
  name,
  email,
  role,
  scopeValue,
}: {
  name: string;
  email: string;
  role: UserRole;
  scopeValue: string;
}) {
  const [fullName, setFullName] = React.useState(name);
  const [phone, setPhone] = React.useState("");

  return (
    <SectionCard
      title="Your account"
      detail="Name and contact details are yours to change. Role and building scope are set by an administrator."
    >
      <div className="border-border flex items-center gap-3.5 border-b pb-4.5">
        <div className="bg-primary text-primary-foreground flex size-13.5 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{name}</div>
          <div className="text-muted-foreground mt-1 font-mono text-[11px]">
            {email}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info("Photo upload (demo only).")}
        >
          Change photo
        </Button>
      </div>

      <div className="mt-4.5 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Full name</FieldLabel>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Phone</FieldLabel>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09 xxx xxx xxx"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Role</FieldLabel>
          <div className="border-border bg-surface-subtle text-foreground/70 flex items-center gap-2 rounded-md border px-2.5 py-2.25 text-[12px]">
            <Lock className="text-muted-foreground size-3 shrink-0" />
            {roleLabel[role]}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Building scope</FieldLabel>
          <div className="border-border bg-surface-subtle text-foreground/70 flex items-center gap-2 rounded-md border px-2.5 py-2.25 text-[12px]">
            <Lock className="text-muted-foreground size-3 shrink-0" />
            {scopeValue}
          </div>
        </div>
      </div>

      <div className="mt-4.5 flex items-center gap-3">
        <Button onClick={() => toast.success("Profile saved.")}>
          Save changes
        </Button>
        <span className="text-muted-foreground text-[11px]">
          Last signed in{" "}
          {formatRelative(new Date(Date.now() - 1.4e6).toISOString())}
        </span>
      </div>
    </SectionCard>
  );
}

// ---- Appearance ----------------------------------------------------------

const THEMES = [
  {
    id: "light",
    label: "Light",
    ink: "#111318",
    muted: "#c9cdd6",
    accent: "#4169e1",
    bg: "#fff",
  },
  {
    id: "dark",
    label: "Dark",
    ink: "#e9ebef",
    muted: "#2a2f3a",
    accent: "#5c7ce8",
    bg: "#171a21",
  },
  {
    id: "system",
    label: "System",
    ink: "#4a5160",
    muted: "#c9cdd6",
    accent: "#4169e1",
    bg: "#f4f5f7",
  },
] as const;

const ACCENTS = [
  { id: "blue", label: "Blue", swatch: "#4169e1" },
  { id: "green", label: "Green", swatch: "#16a34a" },
  { id: "amber", label: "Amber", swatch: "#d97706" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
] as const;

const DENSITIES = [
  { id: "comfortable", label: "Comfortable", pad: 14 },
  { id: "compact", label: "Compact", pad: 10 },
  { id: "cozy", label: "Cozy", pad: 7 },
] as const;

function AppearanceSection() {
  const [theme, setTheme] =
    React.useState<(typeof THEMES)[number]["id"]>("light");
  const [accent, setAccent] =
    React.useState<(typeof ACCENTS)[number]["id"]>("blue");
  const [density, setDensity] =
    React.useState<(typeof DENSITIES)[number]["id"]>("comfortable");

  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const activeAccent = ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0];
  const activeDensity = DENSITIES.find((d) => d.id === density) ?? DENSITIES[0];

  return (
    <SectionCard
      title="Appearance"
      detail="Saved against your account, not the building. The preview below updates as you choose."
    >
      <FieldLabel>Theme</FieldLabel>
      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className={cn(
              "overflow-hidden rounded-md border text-left",
              theme === t.id ? "border-primary" : "border-border",
            )}
          >
            <div
              className="flex h-15.5 flex-col gap-1.5 border-b p-2.25"
              style={{ background: t.bg, borderColor: t.muted }}
            >
              <span
                className="h-1.5 w-[58%] rounded-full"
                style={{ background: t.ink }}
              />
              <span
                className="h-1 w-[80%] rounded-full opacity-60"
                style={{ background: t.ink }}
              />
              <span
                className="h-1 w-[44%] rounded-full"
                style={{ background: t.accent }}
              />
            </div>
            <div className="flex items-center gap-1.75 px-2.5 py-2.25">
              <span
                className={cn(
                  "size-3 shrink-0 rounded-full border",
                  theme === t.id
                    ? "border-primary bg-primary"
                    : "border-input bg-transparent",
                )}
              />
              <span className="text-[11.5px] font-[450]">{t.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <FieldLabel>Accent</FieldLabel>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccent(a.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2.75 py-2",
                accent === a.id
                  ? "border-primary bg-accent/40"
                  : "border-border",
              )}
            >
              <span
                className="size-3.5 shrink-0 rounded-[3px]"
                style={{ background: a.swatch }}
              />
              <span className="text-[11.5px] font-[450]">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Density</FieldLabel>
        <div className="bg-secondary border-border mt-2.5 flex w-fit items-center gap-1 rounded-md border p-[3px]">
          {DENSITIES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDensity(d.id)}
              className={cn(
                "cursor-pointer rounded px-3 py-1.5 text-[11.5px] font-medium whitespace-nowrap",
                density === d.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-border mt-5 overflow-hidden rounded-md border">
        <div className="bg-surface-subtle border-border text-muted-foreground border-b px-3 py-2 font-mono text-[10px] tracking-wider uppercase">
          Preview
        </div>
        <div style={{ padding: activeDensity.pad, background: "#f4f5f7" }}>
          <div
            className="rounded-md border border-l-[3px]"
            style={{
              borderColor: "#d8dbe1",
              borderLeftColor: activeAccent.swatch,
              background: activeTheme.bg,
              padding: activeDensity.pad,
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[10.5px]"
                style={{ color: activeAccent.swatch }}
              >
                REQ-4192
              </span>
              <span className="bg-warning-muted text-warning-foreground rounded-[3px] px-1.5 py-0.75 font-mono text-[9px] tracking-wider uppercase">
                High
              </span>
              <div className="flex-1" />
              <span className="text-muted-foreground font-mono text-[10px]">
                31h
              </span>
            </div>
            <div
              className="mt-2 text-[12.5px] font-[450]"
              style={{ color: activeTheme.ink }}
            >
              Projector will not power on; lamp indicator flashing red
            </div>
            <div className="text-muted-foreground mt-1.25 font-mono text-[10.5px]">
              Building 216 / Room 302
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4.5 flex items-center gap-3">
        <Button onClick={() => toast.success("Appearance saved.")}>
          Save appearance
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setTheme("light");
            setAccent("blue");
            setDensity("comfortable");
          }}
        >
          Reset to default
        </Button>
        <span className="text-muted-foreground text-[11px]">
          Dark and System stay in preview for this build.
        </span>
      </div>
    </SectionCard>
  );
}

// ---- Notifications ---------------------------------------------------------

interface NotifRow {
  id: string;
  label: string;
  detail: string;
  forced?: boolean;
}

const NOTIF_ROWS: NotifRow[] = [
  {
    id: "fire",
    label: "Fire alarm & life-safety alerts",
    detail: "Triggered or offline fire/life-safety sensors.",
    forced: true,
  },
  {
    id: "priority",
    label: "High-priority request opened",
    detail: "A new request is submitted with High priority.",
  },
  {
    id: "aging",
    label: "Request aging past 24h",
    detail: "A high-priority request has been open past the escalation window.",
  },
  {
    id: "faulty",
    label: "Equipment marked faulty",
    detail: "Any unit in your scope changes to Faulty.",
  },
  {
    id: "report",
    label: "Weekly report ready",
    detail: "A new performance or reliability report is generated.",
  },
  {
    id: "building",
    label: "Building added to the estate",
    detail: "Administration adds a new building or room.",
  },
];

type NotifChannels = { inApp: boolean; email: boolean; sms: boolean };

const NOTIF_DEFAULTS: Record<string, NotifChannels> = {
  fire: { inApp: true, email: true, sms: true },
  priority: { inApp: true, email: true, sms: false },
  aging: { inApp: true, email: true, sms: false },
  faulty: { inApp: true, email: false, sms: false },
  report: { inApp: true, email: true, sms: false },
  building: { inApp: true, email: false, sms: false },
};

function NotificationsSection() {
  const [prefs, setPrefs] =
    React.useState<Record<string, NotifChannels>>(NOTIF_DEFAULTS);

  const toggle = (rowId: string, channel: keyof NotifChannels) => {
    setPrefs((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [channel]: !prev[rowId][channel] },
    }));
  };

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="px-4.5 pt-4.5 pb-4 lg:px-5 lg:pt-5">
        <div className="text-[13.5px] font-semibold">Notifications</div>
        <p className="text-muted-foreground mt-1.5 text-[11.5px] leading-relaxed">
          Choose what reaches you and how. Fire alarms always notify every
          channel — that one cannot be turned off.
        </p>
      </div>
      <div className="bg-surface-subtle border-border text-muted-foreground flex border-y px-4.5 py-2 font-mono text-[9.5px] tracking-wider uppercase lg:px-5">
        <span className="flex-1">Event</span>
        <span className="w-15 text-center max-sm:hidden">In app</span>
        <span className="w-15 text-center max-sm:hidden">Email</span>
        <span className="w-15 text-center max-sm:hidden">SMS</span>
      </div>
      {NOTIF_ROWS.map((row) => {
        const channels = prefs[row.id];
        return (
          <div
            key={row.id}
            className="border-border/60 flex items-center border-b px-4.5 py-3 last:border-b-0 lg:px-5"
          >
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-[450]">{row.label}</span>
                {row.forced && (
                  <span className="bg-danger-muted text-danger-foreground rounded-[3px] px-1.5 py-0.75 font-mono text-[9px] tracking-wider uppercase">
                    Always on
                  </span>
                )}
              </div>
              <div className="text-muted-foreground mt-1 text-[10.5px] leading-relaxed">
                {row.detail}
              </div>
            </div>
            {(["inApp", "email", "sms"] as const).map((c) => (
              <div key={c} className="flex w-15 shrink-0 justify-center">
                <Switch
                  size="sm"
                  checked={channels[c]}
                  disabled={row.forced}
                  onCheckedChange={() => toggle(row.id, c)}
                />
              </div>
            ))}
          </div>
        );
      })}
      <div className="bg-surface-subtle flex items-center gap-3 px-4.5 py-3.5 lg:px-5">
        <Button
          size="sm"
          onClick={() => toast.success("Notification preferences saved.")}
        >
          Save preferences
        </Button>
        <span className="text-muted-foreground text-[11px]">
          Quiet hours aren&apos;t configured for this account.
        </span>
      </div>
    </Card>
  );
}

// ---- Monitoring (CEO only) --------------------------------------------

function MonitoringLocked({
  currentRoleLabel,
  onSwitch,
}: {
  currentRoleLabel: string;
  onSwitch: () => void;
}) {
  return (
    <Card className="gap-3 p-9 text-center">
      <Lock className="text-muted-foreground mx-auto size-7" />
      <div className="text-[13.5px] font-semibold">
        Monitoring thresholds are CEO-only
      </div>
      <p className="text-muted-foreground mx-auto max-w-[56ch] text-[12px] leading-relaxed">
        Polling, escalation and alarm behaviour apply to the whole estate, so
        they sit with the CEO / Super Admin. Your role is{" "}
        <span className="font-mono">{currentRoleLabel}</span>.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mx-auto mt-1"
        onClick={onSwitch}
      >
        Switch to CEO for this demo
      </Button>
    </Card>
  );
}

interface SliderSpec {
  id: string;
  label: string;
  detail: string;
  options: string[];
  defaultValue: string;
}

const SLIDERS: SliderSpec[] = [
  {
    id: "escalation",
    label: "Escalation window",
    detail:
      "How long a high-priority request can sit before it's flagged as aging on the Requests page.",
    options: ["12h", "24h", "48h"],
    defaultValue: "24h",
  },
  {
    id: "polling",
    label: "Sensor polling interval",
    detail: "How often the sensor network is expected to report in.",
    options: ["15s", "30s", "1m", "5m"],
    defaultValue: "30s",
  },
  {
    id: "offline",
    label: "Offline sensor timeout",
    detail:
      "How long a sensor can miss its check-in before it shows as Offline.",
    options: ["2m", "5m", "10m"],
    defaultValue: "5m",
  },
];

function MonitoringSection() {
  const [values, setValues] = React.useState<Record<string, string>>(
    Object.fromEntries(SLIDERS.map((s) => [s.id, s.defaultValue])),
  );
  const [autoEscalate, setAutoEscalate] = React.useState(true);
  const [notifyOffline, setNotifyOffline] = React.useState(true);
  const [nightlyReports, setNightlyReports] = React.useState(false);

  return (
    <SectionCard
      title="Monitoring"
      detail="Estate-wide thresholds. Changing these changes what the other pages count as late, offline or in alarm."
    >
      <div className="flex flex-col gap-5">
        {SLIDERS.map((s) => (
          <div key={s.id}>
            <div className="flex items-baseline gap-2.5">
              <span className="flex-1 text-[12.5px] font-[450]">{s.label}</span>
              <span className="text-accent-foreground font-mono text-[13px] font-semibold">
                {values[s.id]}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 max-w-[68ch] text-[10.5px] leading-relaxed">
              {s.detail}
            </p>
            <div className="mt-2.25 flex flex-wrap gap-1.75">
              {s.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setValues((prev) => ({ ...prev, [s.id]: opt }))
                  }
                  className={cn(
                    "rounded-md border px-3 py-1.75 font-mono text-[11px] font-medium",
                    values[s.id] === opt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground/70",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-border mt-5 flex flex-col gap-3.5 border-t pt-4.5">
        <MonToggle
          label="Auto-escalate high-priority requests"
          detail="Mark a high-priority request as aging the moment it passes the escalation window, without waiting for a refresh."
          checked={autoEscalate}
          onCheckedChange={setAutoEscalate}
        />
        <MonToggle
          label="Notify on sensor offline"
          detail="Send a notification the moment a sensor misses its check-in window."
          checked={notifyOffline}
          onCheckedChange={setNotifyOffline}
        />
        <MonToggle
          label="Nightly report generation"
          detail="Automatically generate the next scheduled report overnight instead of on request."
          checked={nightlyReports}
          onCheckedChange={setNightlyReports}
        />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => toast.success("Monitoring thresholds saved.")}>
          Save thresholds
        </Button>
        <span className="text-muted-foreground text-[11px]">
          Applies across every building in the estate.
        </span>
      </div>
    </SectionCard>
  );
}

function MonToggle({
  label,
  detail,
  checked,
  onCheckedChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-[450]">{label}</div>
        <div className="text-muted-foreground mt-1 max-w-[70ch] text-[10.5px] leading-relaxed">
          {detail}
        </div>
      </div>
    </div>
  );
}

// ---- Security --------------------------------------------------------------

interface Session {
  id: string;
  device: string;
  meta: string;
  icon: typeof Laptop;
  current?: boolean;
}

const INITIAL_SESSIONS: Session[] = [
  {
    id: "this",
    device: "Chrome on Windows",
    meta: "Yangon · active now",
    icon: Laptop,
    current: true,
  },
  {
    id: "s2494",
    device: "Safari on iPhone",
    meta: "Yangon · 2 days ago",
    icon: Smartphone,
  },
  {
    id: "s2410",
    device: "Chrome on Windows",
    meta: "Junction Square kiosk · 6 days ago",
    icon: Laptop,
  },
];

function SecuritySection() {
  const confirm = useConfirm();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmPass, setConfirmPass] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState(INITIAL_SESSIONS);

  const handleChangePassword = () => {
    if (next.length < 10) {
      setError("New password must be at least 10 characters.");
      return;
    }
    if (next !== confirmPass) {
      setError("New password and confirmation don't match.");
      return;
    }
    setError(null);
    setCurrent("");
    setNext("");
    setConfirmPass("");
    toast.success("Password changed. You've been kept signed in here.");
  };

  const endSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Session ended.");
  };

  const endAll = async () => {
    const result = await confirm({
      title: "Sign out of all other sessions?",
      body: "Every other device currently signed in to this account will be signed out immediately.",
      tone: "warning",
      confirmLabel: "Sign out everywhere else",
    });
    if (!result.confirmed) return;
    setSessions((prev) => prev.filter((s) => s.current));
    toast.success("Signed out of all other sessions.");
  };

  return (
    <div className="flex flex-col gap-3.5">
      <SectionCard
        title="Password"
        detail="Changing your password signs you out everywhere else. Last changed 62 days ago."
      >
        <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Current</FieldLabel>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>New</FieldLabel>
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Confirm</FieldLabel>
            <Input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p className="text-warning-foreground mt-2.5 text-[11.5px]">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button onClick={handleChangePassword}>Change password</Button>
          <Link
            href="/login/forgot-password"
            className="text-primary text-[11.5px] font-medium hover:underline"
          >
            Forgot your current password?
          </Link>
        </div>
      </SectionCard>

      <Card className="gap-0 overflow-hidden p-0">
        <div className="px-4.5 pt-4.5 pb-4 lg:px-5 lg:pt-5">
          <div className="text-[13.5px] font-semibold">Sessions</div>
          <p className="text-muted-foreground mt-1.5 text-[11.5px] leading-relaxed">
            Where your account is signed in. Sessions end after 30 minutes
            without activity.
          </p>
        </div>
        {sessions.map((s) => (
          <div
            key={s.id}
            className="border-border/60 flex items-center gap-3 border-t px-4.5 py-3 lg:px-5"
          >
            <s.icon className="text-muted-foreground size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-[450]">{s.device}</div>
              <div className="text-muted-foreground mt-0.5 font-mono text-[10.5px]">
                {s.meta}
              </div>
            </div>
            {s.current ? (
              <span className="bg-success-muted text-success-foreground shrink-0 rounded-[3px] px-1.5 py-0.75 font-mono text-[9px] tracking-wider uppercase">
                This device
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-danger/40 text-danger-foreground hover:bg-danger-muted shrink-0"
                onClick={() => endSession(s.id)}
              >
                End session
              </Button>
            )}
          </div>
        ))}
        <div className="bg-surface-subtle border-border border-t px-4.5 py-3.5 lg:px-5">
          <Button
            variant="outline"
            size="sm"
            className="border-danger/40 text-danger-foreground hover:bg-danger-muted"
            onClick={endAll}
            disabled={sessions.length <= 1}
          >
            Sign out of all other sessions
          </Button>
        </div>
      </Card>
    </div>
  );
}
