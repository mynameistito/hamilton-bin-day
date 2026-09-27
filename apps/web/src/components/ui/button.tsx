import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: "default" | "outline";
}

const buttonTypeProps = (
  type: ButtonHTMLAttributes<HTMLButtonElement>["type"]
): Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type"> => {
  if (type === "submit") {
    return { type: "submit" };
  }
  if (type === "reset") {
    return { type: "reset" };
  }
  return { type: "button" };
};

export const Button = ({
  className = "",
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) => (
  <button
    {...props}
    type="button"
    {...buttonTypeProps(type)}
    className={`focus-visible:outline-focus-leaf inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60 ${variant === "default" ? "bg-forest text-white hover:brightness-110" : "border-sage-border bg-surface text-step-copy hover:bg-panel border"} ${className}`}
  />
);
