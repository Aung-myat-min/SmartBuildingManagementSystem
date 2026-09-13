"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatClock } from "@/lib/format";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.25">
      <span className="border-primary relative size-6 shrink-0 rounded-[3px] border-2">
        <span className="bg-primary absolute inset-1 opacity-55" />
      </span>
      <span className="text-[11.5px] font-semibold">
        Smart Building Monitoring
      </span>
    </div>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [expiry, setExpiry] = React.useState("");
  const [resendCooldown, setResendCooldown] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter the university address your account uses.");
      return;
    }
    setError(null);
    setExpiry(formatClock(new Date(Date.now() + 30 * 60 * 1000)));
    setSent(true);
    setResendCooldown(30);
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-10">
      <div className="border-border bg-card w-full max-w-93.5 rounded-md border p-6.5 pb-6">
        <BrandMark />

        {!sent ? (
          <>
            <div className="mt-5 text-[17px] font-semibold">
              Reset your password
            </div>
            <p className="text-muted-foreground mt-2 text-[12px] leading-relaxed">
              Enter the university address your account uses. We send a
              single-use link that expires in 30 minutes.
            </p>
            <form
              onSubmit={handleSend}
              className="mt-4.5 flex flex-col gap-1.5"
            >
              <Label className="font-mono text-[10px] tracking-wider text-foreground/70 uppercase">
                Email
              </Label>
              <Input
                type="text"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="name@university.edu"
                className="focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {error && (
                <p className="text-warning-foreground mt-1 text-[11.5px] leading-relaxed">
                  {error}
                </p>
              )}
              <Button type="submit" className="mt-2.5 w-full">
                Send reset link
              </Button>
            </form>
            <div className="border-border mt-4.5 flex items-center gap-1.5 border-t pt-3.5">
              <span className="text-muted-foreground text-[11.5px]">
                Remembered it?
              </span>
              <Link
                href="/login"
                className="text-primary text-[11.5px] font-medium hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="bg-success-muted text-success-foreground mt-5 flex size-8.5 items-center justify-center rounded-full">
              <CheckCircle2 className="size-4.25" />
            </div>
            <div className="mt-3.5 text-[17px] font-semibold">
              Check your email
            </div>
            <p className="text-foreground/80 mt-2 text-[12px] leading-relaxed">
              A reset link is on its way to{" "}
              <span className="font-mono text-[11.5px]">{email}</span>. It works
              once and expires at {expiry}.
            </p>
            <p className="text-muted-foreground border-border bg-surface-subtle mt-3 rounded-md border p-2.75 text-[11.5px] leading-relaxed">
              Nothing arrived? Check the junk folder, then ask an Admin Manager
              to confirm the address on your account.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={resendCooldown > 0}
              onClick={() => setResendCooldown(30)}
            >
              {resendCooldown > 0
                ? `Resend link in ${resendCooldown}s`
                : "Resend link"}
            </Button>
            <div className="border-border mt-4 flex items-center gap-1.5 border-t pt-3.5">
              <Link
                href="/login"
                className="text-primary text-[11.5px] font-medium hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
