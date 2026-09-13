"use client";

import { KeyRound, Lock, Palette, UserRound } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/lib/app-state";
import { formatRelative } from "@/lib/format";
import { BUILDINGS } from "@/lib/mock-data";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type SectionId = "profile" | "appearance" | "security";

const SECTIONS: { id: SectionId; label: string; icon: typeof UserRound }[] = [
  { id: "profile", label: "Your account", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Password", icon: KeyRound },
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
  const { currentUser, role, activeBuildingId } = useAppState();
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

function AppearanceSection() {
  // next-themes owns the value; `theme` may be "system", and resolvedTheme is
  // what the page is actually painting.
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const current = mounted ? (theme ?? "system") : "system";
  const preview =
    THEMES.find((t) => t.id === (mounted ? resolvedTheme : "light")) ??
    THEMES[0];

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
              "cursor-pointer overflow-hidden rounded-md border text-left",
              current === t.id ? "border-primary" : "border-border",
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
                  current === t.id
                    ? "border-primary bg-primary"
                    : "border-input bg-transparent",
                )}
              />
              <span className="text-[11.5px] font-[450]">{t.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="border-border mt-5 overflow-hidden rounded-md border">
        <div className="bg-surface-subtle border-border text-muted-foreground border-b px-3 py-2 font-mono text-[10px] tracking-wider uppercase">
          Preview
        </div>
        <div className="bg-background p-3.5">
          <div className="border-border border-l-primary bg-card rounded-md border border-l-[3px] p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-accent-foreground font-mono text-[10.5px]">
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
            <div className="text-foreground mt-2 text-[12.5px] font-[450]">
              Projector will not power on; lamp indicator flashing red
            </div>
            <div className="text-muted-foreground mt-1.25 font-mono text-[10.5px]">
              Building 216 / Room 302
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4.5 flex flex-wrap items-center gap-3">
        <Button onClick={() => toast.success("Appearance saved.")}>
          Save appearance
        </Button>
        <Button variant="outline" onClick={() => setTheme("system")}>
          Reset to default
        </Button>
        <span className="text-muted-foreground text-[11px]">
          Currently painting {preview.label.toLowerCase()}.
        </span>
      </div>
    </SectionCard>
  );
}

// ---- Security --------------------------------------------------------------

function SecuritySection() {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmPass, setConfirmPass] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-3.5">
      <SectionCard
        title="Password"
        detail="Changing your password signs you out on every other device. Last changed 62 days ago."
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
    </div>
  );
}
