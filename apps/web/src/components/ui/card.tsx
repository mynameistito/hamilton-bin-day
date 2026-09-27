import type { HTMLAttributes } from "react";

export const Card = ({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <article
    className={`border-card-border bg-surface shadow-lookup overflow-hidden rounded-[1.75rem] border ${className}`}
    {...props}
  />
);
