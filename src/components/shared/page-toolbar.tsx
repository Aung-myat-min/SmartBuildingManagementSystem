"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import { StickyToolbar } from "@/components/shared/sticky-toolbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The one page toolbar.
 *
 * Six pages used to paste the same flex-wrap row and hope. On a desktop that
 * row is right; on a phone eleven controls wrapped into three tiers of mixed
 * chrome and the list started below the fold — the Equipment bar measured
 * 143px, a fifth of the viewport, before a single asset was visible.
 *
 * So the slots are named by what a control *does*, and the two widths answer
 * that differently:
 *
 * - `search` and `actions` are in reach at both widths.
 * - `views` is navigation — which face of the page you are on — and never
 *   goes behind a button. On a phone it drops to a scrolling rail under the
 *   bar.
 * - `filters` narrow a list. On a phone they move into a bottom sheet behind
 *   a button carrying the number that are set.
 * - `status` is not a control at all. On a phone the badges become one muted
 *   line below the bar rather than a row of chips inside it.
 *
 * The switch is CSS, not `useIsMobile()`: that hook resolves in an effect and
 * so reports desktop on the first render, which would flash the wide bar on
 * every page load. `hidden md:contents` makes the wrapper disappear at `md`
 * and its children join the flex row exactly where they always sat.
 */
export function PageToolbar({
  search,
  views,
  filters,
  status,
  actions,
  spread = false,
  activeFilters = 0,
  onReset,
  filtersNote,
}: {
  search?: React.ReactNode;
  /** Tabs or a view switch. Rendered in the bar, and again as the phone rail. */
  views?: React.ReactNode;
  /** Everything that narrows the list. Rendered in the bar, and again in the sheet. */
  filters?: React.ReactNode;
  /** Counts and badges. Rendered in the bar, and again as the phone status line. */
  status?: React.ReactNode;
  /**
   * Buttons. Shown at both widths, so wrap each label in
   * `<span className="max-md:hidden">` and give the button an icon — on a
   * phone these collapse to glyphs.
   */
  actions?: React.ReactNode;
  /** Push the actions to the right edge on desktop. */
  spread?: boolean;
  /** How many filters are away from their default. Drives the button's badge. */
  activeFilters?: number;
  /** Clears every filter. Without it the sheet shows no Reset. */
  onReset?: () => void;
  /** A line at the top of the sheet, where the page wants to explain itself. */
  filtersNote?: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  // A page with no search box has room for its tabs in the bar itself, and a
  // bar holding two buttons at one end with the rest empty looks broken. Only
  // where search already claims the row do the views drop to a rail below it.
  const viewsOnRail = Boolean(views && search);

  return (
    <>
      <StickyToolbar>
        <div className="border-border bg-card flex flex-nowrap items-center gap-2 rounded-[5px] border px-3 py-2.25 md:flex-wrap">
          {search}
          {views &&
            (viewsOnRail ? (
              <div className="hidden md:contents">{views}</div>
            ) : (
              views
            ))}
          {filters && (
            <div className="hidden md:contents">
              {/* The rule after the tabs is what keeps "which view" from
                  reading as just another filter. */}
              {views && (
                <span className="bg-divider mx-0.5 h-6 w-px shrink-0" />
              )}
              {filters}
            </div>
          )}
          {status && (
            <div className="hidden md:contents">
              <span className="bg-divider h-5.5 w-px shrink-0" />
              {status}
            </div>
          )}
          {spread && <div className="hidden flex-1 md:block" />}
          {!search && <div className="flex-1 md:hidden" />}
          {filters && (
            <FiltersButton
              count={activeFilters}
              onClick={() => setSheetOpen(true)}
            />
          )}
          {actions}
        </div>
      </StickyToolbar>

      {viewsOnRail && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 md:hidden">
          {views}
        </div>
      )}

      {status && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px] md:hidden">
          {status}
        </div>
      )}

      {filters && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="max-h-[80vh] max-w-none gap-0 rounded-t-xl p-0"
          >
            {/* The bottom tab bar is fixed over everything below `md`, so the
                sheet's own last control has to clear it or it cannot be
                pressed. */}
            <div className="flex h-full flex-col gap-3 overflow-y-auto px-5 pt-4.5 pb-24">
              <div className="flex items-center gap-2.5">
                <SheetTitle className="text-muted-foreground flex-1 font-mono text-[10px] font-medium tracking-[0.07em] uppercase">
                  Filters
                </SheetTitle>
                {onReset && activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer text-[11.5px] font-medium underline underline-offset-2"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  title="Close"
                  onClick={() => setSheetOpen(false)}
                  className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[17px] leading-none"
                >
                  ×
                </button>
              </div>

              {filtersNote && (
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  {filtersNote}
                </p>
              )}

              {/* The controls are the same controlled inputs as the bar's, over
                  the same state, so the two copies cannot disagree. Stacked
                  full width here, because a phone has one column. */}
              <div className="flex flex-col gap-2.5 [&>*]:min-h-10 [&>*]:w-full [&>select]:px-2.5">
                {filters}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

/** The phone-only button that opens the filter sheet, with the count that is set. */
function FiltersButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `Filters — ${count} set` : "Filters — none set"}
      className={cn(
        "interactive focus-ring pressable flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded border px-2.5 text-[11.5px] leading-none font-medium md:hidden",
        count > 0
          ? "border-primary bg-accent text-accent-foreground"
          : "border-input bg-card text-neutral-foreground",
      )}
    >
      <SlidersHorizontal className="size-3.5" />
      {count > 0 && (
        <span className="bg-primary text-primary-foreground flex size-4 items-center justify-center rounded-full font-mono text-[9.5px] leading-none">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * The toolbar search box.
 *
 * Five pages had this markup pasted verbatim and only one of them had the
 * clear button, so on four of them a stale query could only be removed a
 * keystroke at a time.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "interactive focus-within:ring-3 focus-within:ring-primary/15 border-input focus-within:border-primary bg-card flex min-w-0 flex-1 items-center gap-1.5 rounded border px-2 md:min-w-45",
        className,
      )}
    >
      <Search className="text-muted-foreground size-3.25 shrink-0" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
      />
      {value && (
        <button
          type="button"
          title="Clear search"
          onClick={() => onChange("")}
          className="interactive focus-ring text-muted-foreground hover:text-foreground cursor-pointer px-0.5 text-[15px] leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  id: T;
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  disabled?: boolean;
}

/**
 * The segmented view switch — Monitoring/Thresholds, Board/Table, Register/Board.
 *
 * Five pages hand-rolled the same pill group. It is one component now so the
 * phone rail and the desktop pill cannot drift apart, and so a switch between
 * two faces of a page never reads as one more filter chip.
 */
export function ToolbarSegment<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly SegmentOption<T>[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-secondary border-border flex shrink-0 items-center gap-1 rounded-[5px] border p-[3px]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            title={o.title}
            aria-pressed={active}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "interactive focus-ring flex cursor-pointer items-center gap-1.5 rounded-[3px] px-2.5 py-1.75 text-[11.5px] leading-none font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45",
              active
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70 hover:text-foreground",
            )}
          >
            {o.icon && <o.icon className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** How many of these filters are away from their default. */
export function activeCount(...set: boolean[]): number {
  return set.filter(Boolean).length;
}
