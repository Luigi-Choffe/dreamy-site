import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* --------------------------------------------------------------------------
   Field wrapper: label + hint + mensagem de erro acessível (aria-describedby)
   -------------------------------------------------------------------------- */
export interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
  className?: string;
  children: ReactNode;
}

export function fieldDescribedBy(id: string, hint?: ReactNode, error?: string | null) {
  const ids: string[] = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length ? ids.join(" ") : undefined;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  optionalLabel = "opcional",
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-small font-semibold text-foreground">
        {label}
        {!required ? <span className="ml-1.5 font-normal text-foreground-subtle">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-error">
          <span aria-hidden="true" className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-error" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Controles — estados: default, hover, focus-visible, disabled, error
   -------------------------------------------------------------------------- */
const controlBase =
  "w-full rounded-md border bg-surface text-foreground placeholder:text-foreground-subtle/80 " +
  "transition-[border-color,box-shadow,background-color] duration-(--duration-fast) ease-(--ease-out) " +
  "hover:border-border-strong focus:outline-none focus-visible:outline-none focus:border-brand-strong focus:ring-3 focus:ring-brand-strong/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border " +
  "aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/20";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "h-12 border-border px-4 text-base", className)}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 5, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(controlBase, "min-h-32 resize-y border-border px-4 py-3 text-base leading-relaxed", className)}
      {...props}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  placeholder?: string;
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, placeholder, options, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(controlBase, "h-12 appearance-none border-border pr-11 pl-4 text-base", className)}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-foreground-subtle"
      />
    </div>
  );
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  invalid?: boolean;
  error?: string | null;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, className, invalid, error, ...props },
  ref,
) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-small text-foreground-muted">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={invalid || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "peer mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-xs border border-border-strong bg-surface",
            "transition-[background-color,border-color,box-shadow] duration-(--duration-fast)",
            "checked:border-brand-strong checked:bg-brand-strong",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "aria-[invalid=true]:border-error",
            "checked:bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23fff' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5l3 3 6-6'/%3E%3C/svg%3E\")] bg-center bg-no-repeat",
          )}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});

/* --------------------------------------------------------------------------
   Grupo de opções (radio) estilizado como cards — acessível por teclado.
   -------------------------------------------------------------------------- */
export interface ChoiceGroupProps {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optionalLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  columns?: 1 | 2;
  disabled?: boolean;
}

export function ChoiceGroup({
  name,
  legend,
  hint,
  error,
  required,
  optionalLabel = "opcional",
  value,
  onChange,
  options,
  columns = 1,
  disabled,
}: ChoiceGroupProps) {
  const describedBy = fieldDescribedBy(name, hint, error);
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-small font-semibold text-foreground">
        {legend}
        {!required ? <span className="ml-1.5 font-normal text-foreground-subtle">({optionalLabel})</span> : null}
      </legend>
      <div className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "relative flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-small text-foreground",
                "transition-[border-color,background-color,box-shadow] duration-(--duration-fast) ease-(--ease-out)",
                "hover:border-border-strong has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus",
                checked ? "border-brand-strong bg-brand-soft/60 shadow-sm" : "border-border bg-surface",
                disabled && "cursor-not-allowed opacity-60",
                error && !checked && "border-error/60",
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 z-10 m-0 cursor-pointer appearance-none rounded-md opacity-0 focus:outline-none disabled:cursor-not-allowed"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-4.5 shrink-0 place-items-center rounded-full border",
                  checked ? "border-brand-strong" : "border-border-strong",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full bg-brand-strong transition-opacity",
                    checked ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
      {hint ? (
        <p id={`${name}-hint`} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-error">
          <span aria-hidden="true" className="mt-0.5 inline-block size-1.5 shrink-0 rounded-full bg-error" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
