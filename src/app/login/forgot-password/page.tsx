"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Spinner } from "@/components/shared/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { withMinDuration } from "@/lib/pending";

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
  const { sendReset } = useAuth();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const send = async () => {
    const result = await sendReset(email);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    setError(null);
    setResendCooldown(30);
    return true;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!email.includes("@")) {
      setError("Enter the university address your account uses.");
      return;
    }
    setPending(true);
    // An address the system does not hold reports success too — anything else
    // turns this form into a way of testing whether somebody has an account.
    if (await withMinDuration(send())) setSent(true);
    setPending(false);
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
              single-use link that expires in about an hour.
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
              <Button
                type="submit"
                disabled={pending}
                className="mt-2.5 w-full"
              >
                {pending && <Spinner />}
                {pending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <div className="border-border mt-4.5 flex items-center gap-1.5 border-t pt-3.5">
              <span className="text-muted-foreground text-[11.5px]">
                Remembered it?
              </span>
              <Link
                href="/login"
                className="focus-ring interactive text-primary text-[11.5px] font-medium hover:underline"
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
              If <span className="font-mono text-[11.5px]">{email}</span> is on
              the system, a reset link is on its way. It works once, and expires
              in about an hour.
            </p>
            <p className="text-muted-foreground border-border bg-surface-subtle mt-3 rounded-md border p-2.75 text-[11.5px] leading-relaxed">
              Nothing arrived? Check the junk folder, then ask an Admin Manager
              to confirm the address on your account.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={resendCooldown > 0 || pending}
              onClick={() => void send()}
            >
              {resendCooldown > 0
                ? `Resend link in ${resendCooldown}s`
                : "Resend link"}
            </Button>
            <div className="border-border mt-4 flex items-center gap-1.5 border-t pt-3.5">
              <Link
                href="/login"
                className="focus-ring interactive text-primary text-[11.5px] font-medium hover:underline"
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
