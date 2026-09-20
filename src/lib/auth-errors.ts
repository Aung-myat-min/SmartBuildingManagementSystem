/**
 * Firebase error codes never reach a screen. One map for the login screens and
 * Settings, so the same failure reads the same way everywhere.
 *
 * The three credential failures share one message on purpose: saying an
 * address exists but the password is wrong confirms the address.
 */
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/wrong-password": "That email and password don't match an account.",
  "auth/user-not-found": "That email and password don't match an account.",
  "auth/invalid-email": "Enter the university address your account uses.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests":
    "Too many attempts. Wait a few minutes, or reset your password.",
  "auth/network-request-failed":
    "Can't reach the sign-in service. Check your connection.",
  "auth/user-disabled":
    "This account has been suspended. Ask an Admin Manager.",
  "auth/weak-password": "Password must be at least 10 characters.",
  "auth/requires-recent-login":
    "For safety, sign in again before changing your password.",
  "auth/expired-action-code": "That link has expired. Request a new one below.",
  "auth/invalid-action-code":
    "That link has expired or has already been used. Request a new one below.",
  "auth/email-already-in-use": "An account already uses that email address.",
};

export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return MESSAGES[code] ?? "Something went wrong. Try again.";
}
