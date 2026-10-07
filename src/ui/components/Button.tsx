import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * Buttons of oc3, which writes their classes inline: gathered here so that every
 * view uses the same ones.
 *
 * - `primary`: the accent fill, for the action a form or dialog exists for.
 * - `secondary`: an outline, for the other actions (Cancel, Close, Retry…).
 * - `danger`: the down fill, for an irreversible action once confirmed.
 * - `ghost`: muted ink without border, for toolbar actions.
 */
const VARIANTS = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "border border-line bg-surface-raised text-ink hover:bg-surface-sunken",
  danger: "bg-state-down text-surface-raised hover:brightness-110",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
} as const;

/** `md` is the height of the form and dialog buttons, `sm` the one of the list toolbars. */
const SIZES = { sm: "h-7 px-2", md: "h-8 px-3" } as const;

export type ButtonVariant = keyof typeof VARIANTS;

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: keyof typeof SIZES;
    /** Visual placed before the label. */
    icon?: ReactNode;
  }
>(function Button({ variant = "secondary", size = "md", icon, className, children, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-60",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

/**
 * Square button holding an icon only, as the close cross of the oc3 panels. The
 * label is the tooltip and the accessible name.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    label: string;
    children: ReactNode;
    /** Without the outline, as in the top bar. */
    bare?: boolean;
    /** `sm`: 20px and borderless, to fit a table row. */
    size?: "sm" | "md";
  }
>(function IconButton(
  { label, bare = false, size = "md", className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-(--radius-control) text-ink-muted hover:text-ink disabled:pointer-events-none disabled:opacity-60",
        size === "sm" ? "h-5 w-5 hover:bg-surface-sunken" : "h-7 w-7",
        size === "md" && (bare ? "hover:bg-surface-sunken" : "border border-line"),
        className,
      )}
      {...props}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
});
