"use client";

// The landing page for the link in an invitation or password-reset email.
// Firebase sends people here with ?mode=resetPassword&oobCode=…; the code is
// what proves they read the mailbox, and verifying it is also where the email
// comes from — nothing on this screen is typed by hand.

import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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

// useSearchParams opts the subtree into client rendering, so the oobCode read
// sits behind its own boundary rather than failing the route's prerender —
// which prints after "Compiled successfully", so check the build's exit code.
export default function FirstSignInPage() {
  return (
    <React.Suspense fallback={<Shell>Checking your link…</Shell>}>
      <FirstSignInView />
    </React.Suspense>
  );
}

function FirstSignInView() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();

  const oobCode = params.get("oobCode");
  const [state, setState] = React.useState<"checking" | "ready" | "invalid">(
    "checking",
  );
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!oobCode) {
      setState("invalid");
      setError("This page opens from the link in your email.");
      return;
    }
    let cancelled = false;
    verifyPasswordResetCode(auth, oobCode)
      .then((address) => {
        if (cancelled) return;
        setEmail(address);
        setState("ready");
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(authErrorMessage(cause));
        setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const results = RULES.map((r) => ({ ...r, met: r.test(pass, confirm) }));
  const allMet = results.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allMet || !oobCode || pending) return;
    setPending(true);
    setError(null);
    try {
      await confirmPasswordReset(auth, oobCode, pass);
    } catch (cause) {
      setError(authErrorMessage(cause));
      setPending(false);
      return;
    }
    // The code is spent now, so sign them straight in rather than sending them
    // back to a form they would have to fill in again.
    const result = await signIn(email, pass);
    if (!result.ok) {
      // The password is set even so — /login is the honest next step.
      router.replace("/login");
      return;
    }
    router.replace("/dashboard");
  };

  if (state === "checking") return <Shell>Checking your link…</Shell>;

  if (state === "invalid") {
    return (
      <Shell>
        <div className="text-[17px] font-semibold">This link has expired</div>
        <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
          {error ?? "Reset links work once and do not last long."}
        </p>
        <Link
          href="/login/forgot-password"
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 mt-4.5 block w-full rounded border px-3 py-2 text-center text-[11.5px] font-medium"
        >
          Send a new link
        </Link>
        <div className="border-border mt-4 border-t pt-3.5">
          <Link
            href="/login"
            className="text-primary text-[11.5px] font-medium hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-[17px] font-semibold">Set your password</div>
      <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
        For <span className="font-mono text-[11.5px]">{email}</span>. Choose a
        password you have not used elsewhere.
      </p>

      <form onSubmit={handleSubmit} className="mt-4.5 flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground/70 font-mono text-[10px] tracking-wider uppercase">
            New password
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="At least 10 characters"
            className="focus-visible:border-primary focus-visible:ring-primary/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground/70 font-mono text-[10px] tracking-wider uppercase">
            Confirm password
          </Label>
          <Input
            type="password"
            autoComplete="new-password"
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

        {error && (
          <p className="text-danger-foreground text-[11.5px] leading-relaxed">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-1 w-full"
          disabled={!allMet || pending}
        >
          {pending ? "Setting password…" : "Set password and sign in"}
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
