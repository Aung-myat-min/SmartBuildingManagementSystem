"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/lib/app-state";
import { CURRENT_USERS } from "@/lib/mock-data";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS: { role: UserRole; blurb: string; emailPrefix: string }[] =
  [
    {
      role: "office-staff",
      blurb: "Office Staff — Building 216 only",
      emailPrefix: "staff@",
    },
    {
      role: "admin-manager",
      blurb: "Admin Manager — all buildings",
      emailPrefix: "admin@",
    },
    {
      role: "ceo-super-admin",
      blurb: "CEO / Super Admin — full control",
      emailPrefix: "ceo@",
    },
  ];

export default function LoginPage() {
  const { role, setRole } = useAppState();
  const router = useRouter();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-10">
      <div className="border-border bg-card w-full max-w-105 rounded-md border p-8.5 pb-7 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="border-primary relative size-8 shrink-0 rounded-[3px] border-2">
            <span className="bg-primary absolute inset-1.5 opacity-55" />
          </span>
          <div>
            <div className="text-[15px] font-semibold leading-tight">
              Smart Building Monitoring
            </div>
            <div className="text-muted-foreground mt-0.5 font-mono text-[10.5px] tracking-wider">
              FACILITIES OPERATIONS
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="text-[13px] font-semibold">Sign in</div>
        <p className="text-muted-foreground mt-1.5 text-[12px] leading-relaxed">
          Use your university account. Access is scoped by role.
        </p>

        <form onSubmit={handleSignIn} className="mt-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[11px] tracking-wider text-foreground/70 uppercase">
              Email
            </Label>
            <Input
              type="email"
              placeholder="name@university.edu"
              defaultValue={CURRENT_USERS[role].email}
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[11px] tracking-wider text-foreground/70 uppercase">
              Password
            </Label>
            <Input
              type="password"
              placeholder="••••••••••"
              defaultValue="password"
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="keep-signed-in"
              className="flex items-center gap-1.5 text-[12px] text-foreground/80"
            >
              <Checkbox
                id="keep-signed-in"
                defaultChecked
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              Keep me signed in
            </label>
            <span className="text-primary cursor-pointer text-[12px]">
              Forgot password
            </span>
          </div>
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 mt-1 w-full"
          >
            Sign in
          </Button>
        </form>

        <Separator className="mt-6 mb-4" />

        <div className="text-muted-foreground mb-2.5 font-mono text-[10.5px] tracking-wider uppercase">
          Demo accounts
        </div>
        <div className="flex flex-col gap-1.5">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.role}
              type="button"
              onClick={() => setRole(acct.role)}
              className={cn(
                "hover:border-primary hover:bg-accent/60 flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                role === acct.role
                  ? "border-primary bg-accent/40"
                  : "border-border",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  role === acct.role ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
              <span className="flex-1 text-[12px] font-[450]">
                {acct.blurb}
              </span>
              <span className="text-muted-foreground font-mono text-[10.5px]">
                {acct.emailPrefix}
              </span>
            </button>
          ))}
        </div>
        <p className="text-muted-foreground mt-4 text-center text-[11px] leading-relaxed">
          Currently previewing as{" "}
          <span className="font-medium">{roleLabel[role]}</span>. Picking an
          account changes which dashboard you land on.
        </p>
      </div>
    </div>
  );
}
