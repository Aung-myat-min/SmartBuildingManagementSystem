"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";

/** Why the gate sent someone back here, if it did. */
const REASONS: Record<string, string> = {
  suspended:
    "This account has been suspended. Ask an Admin Manager to restore it.",
  "no-profile":
    "This account has no profile yet. Ask an Admin Manager to finish setting it up.",
  "signed-out": "You have been signed out.",
};

// useSearchParams opts the subtree into client rendering, so the reason read
// sits behind its own boundary rather than failing the route's prerender.
export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginView />
    </React.Suspense>
  );
}

function LoginView() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const reason = params.get("reason");
  const notice = reason ? REASONS[reason] : null;

  // Routing on status rather than from the submit handler: signing in resolves
  // the profile asynchronously, and navigating before that lands in the gate
  // while it still reads "loading", which bounces straight back here.
  React.useEffect(() => {
    if (status === "signed-in") router.replace("/dashboard");
  }, [status, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.message);
      setPending(false);
    }
    // On success the effect above navigates; leaving `pending` set keeps the
    // button from being pressed twice while the profile resolves.
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-10">
      <div className="border-border bg-card w-full max-w-105 rounded-md border p-8.5 pb-7 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="border-primary relative size-8 shrink-0 rounded-[3px] border-2">
            <span className="bg-primary absolute inset-1.5 opacity-55" />
          </span>
          <div>
            <div className="text-[15px] leading-tight font-semibold">
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

        {notice && (
          <p className="bg-warning-muted text-warning-foreground mt-4 rounded-md px-3 py-2.5 text-[11.5px] leading-relaxed">
            {notice}
          </p>
        )}

        <form onSubmit={handleSignIn} className="mt-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground/70 font-mono text-[11px] tracking-wider uppercase">
              Email
            </Label>
            <Input
              type="email"
              autoComplete="username"
              placeholder="name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground/70 font-mono text-[11px] tracking-wider uppercase">
              Password
            </Label>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-visible:border-primary focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11.5px]">
              You stay signed in until this tab closes.
            </span>
            <Link
              href="/login/forgot-password"
              className="text-primary text-[12px] hover:underline"
            >
              Forgot password
            </Link>
          </div>

          {error && (
            <p className="text-danger-foreground text-[11.5px] leading-relaxed">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending}
            className="bg-primary hover:bg-primary/90 mt-1 w-full"
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-muted-foreground mt-5 text-center text-[11px] leading-relaxed">
          Accounts are created by an Admin Manager. If you have not set a
          password yet, use the link in your invitation email.
        </p>
      </div>
    </div>
  );
}
