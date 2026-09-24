import { ShellSkeleton } from "@/components/shell/shell-skeleton";

/**
 * Shown while a route segment's code is still being fetched — the gap between
 * clicking a nav item and its page module arriving, which on a cold load or a
 * slow connection is real.
 *
 * The same skeleton the auth gate and the first-snapshot wait use, so the app
 * has one loading surface rather than three that disagree about the shape of
 * their own shell.
 */
export default function Loading() {
  return <ShellSkeleton note="Opening…" />;
}
