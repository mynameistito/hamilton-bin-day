import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly variant?: "default" | "search";
}

const inputVariantClass: Record<NonNullable<InputProps["variant"]>, string> = {
  default:
    "placeholder:text-placeholder focus-visible:ring-focus-leaf rounded-xl px-4 py-3.5 text-base focus-visible:ring-2",
  search:
    "border-sage-border bg-panel text-ink focus-visible:ring-focus-leaf shadow-lookup placeholder:text-placeholder focus-visible:border-focus-leaf focus-visible:ring-offset-canvas h-14 w-full rounded-xl border-2 px-4 text-base transition focus-visible:ring-2 focus-visible:ring-offset-2 sm:text-lg",
};

/** Render a standard form input or a prominent catalogue search field.
 * @returns The styled input element.
 */
export const Input = ({
  className = "",
  variant = "default",
  ...props
}: InputProps) => (
  <input
    className={`min-w-0 flex-1 outline-none ${inputVariantClass[variant]} ${className}`}
    {...props}
  />
);
