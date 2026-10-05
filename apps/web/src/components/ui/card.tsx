import type { HTMLAttributes } from "react";

/** Render a semantic article container with the shared card surface styling.
 * @returns The styled card element.
 */
export const Card = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <article
    className={`overflow-hidden rounded-[1.75rem] border border-card-border bg-surface shadow-lookup ${className}`}
    {...props}
  />
);
