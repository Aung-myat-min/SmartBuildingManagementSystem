"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const NEW_USER_EMAIL = "thet.naing@university.edu";

interface Rule {
  id: string;
  label: string;
  test: (pass: string, confirm: string) => boolean;
}

const RULES: Rule[] = [
  { id: "len", label: "At least 10 characters", test: (p) => p.length >= 10 },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (p) => /[A-Z]/.test(p),
  },
  { id: "num", label: "One number", test: (p) => /[0-9]/.test(p) },
  {
    id: "match",
    label: "Both passwords match",
    test: (p, c) => p.length > 0 && p === c,
  },
];

export default function FirstSignInPage() {
  const router = useRouter();
  const [pass, setPass] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const results = RULES.map((r) => ({ ...r, met: r.test(pass, confirm) }));
  const allMet = results.every((r) => r.met);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet) return;
    router.push("/dashboard");
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-10">
      <div className="border-border bg-card w-full max-w-93.5 rounded-md border p-6.5 pb-6">
        <div className="flex items-center gap-2.25">
          <span className="border-primary relative size-6 shrink-0 rounded-[3px] border-2">
            <span className="bg-primary absolute inset-1 opacity-55" />
          </span>
          <span className="text-[11.5px] font-semibold">
            Smart Building Monitoring
          </span>
        </div>

        <div className="mt-5 text-[17px] font-semibold">Set your password</div>
        <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
          First sign-in for{" "}
          <span className="font-mono text-[11.5px]">{NEW_USER_EMAIL}</span>.
          Choose a password you have not used elsewhere.
        </p>

        <form onSubmit={handleSubmit} className="mt-4.5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[10px] tracking-wider text-foreground/70 uppercase">
              New password
            </Label>
            <Input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="At least 10 characters"
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[10px] tracking-wider text-foreground/70 uppercase">
              Confirm password
            </Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                    r.met
                      ? "border-success bg-success text-white"
                      : "border-input bg-transparent",
                  )}
                >
                  {r.met && <Check className="size-2.25" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "text-[11.5px]",
                    r.met ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {r.label}
                </span>
              </div>
            ))}
          </div>

          <Button type="submit" className="mt-1 w-full" disabled={!allMet}>
            Set password and sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
