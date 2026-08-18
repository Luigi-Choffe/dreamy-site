import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 rounded-full text-center leading-tight font-semibold " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out) " +
  "select-none outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "active:scale-[0.99]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-brand-ink shadow-sm hover:bg-brand-hover hover:shadow-glow-soft active:bg-brand-active " +
    "motion-safe:hover:scale-[1.02] data-[loading=true]:text-transparent",
  secondary:
    "border border-border-strong bg-transparent text-foreground hover:bg-surface-hover hover:border-foreground/40 " +
    "active:bg-surface-hover data-[loading=true]:text-transparent",
  ghost:
    "bg-transparent text-foreground hover:bg-surface-hover active:bg-surface-hover data-[loading=true]:text-transparent",
  inverse: "bg-foreground text-background hover:opacity-90 active:opacity-85 data-[loading=true]:text-transparent",
  link: "rounded-none p-0 h-auto text-brand-strong underline-offset-4 hover:underline active:opacity-80",
};

const spinnerColors: Record<ButtonVariant, string> = {
  primary: "text-brand-ink",
  secondary: "text-foreground",
  ghost: "text-foreground",
  inverse: "text-background",
  link: "text-brand-strong",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-10 px-4 py-2 text-small",
  md: "min-h-12 px-6 py-2.5 text-[0.9375rem] md:text-base",
  lg: "min-h-13 px-7 py-3 text-base md:text-[1.0625rem]",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(base, variants[variant], variant !== "link" && sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/** Botão com estados: default, hover, active, focus-visible, disabled, loading. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Carregando",
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading ? "true" : undefined}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
      {loading ? (
        <span className={cn("absolute inset-0 grid place-items-center", spinnerColors[variant])}>
          <Spinner className="size-5" label={loadingLabel} />
        </span>
      ) : null}
    </button>
  );
}

export interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  external?: boolean;
}

/** Link com aparência de botão (mesmos estados visuais). */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  leadingIcon,
  trailingIcon,
  external,
  children,
  ...props
}: LinkButtonProps) {
  const externalProps = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Link className={buttonClassName({ variant, size, className })} {...externalProps} {...props}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
