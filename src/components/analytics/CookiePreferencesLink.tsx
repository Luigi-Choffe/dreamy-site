"use client";

import { openConsentPreferences } from "@/lib/consent/consent";
import { cn } from "@/lib/utils/cn";

export function CookiePreferencesLink({
  className,
  label = "Preferências de cookies",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={openConsentPreferences}
      className={cn(
        "cursor-pointer text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
    >
      {label}
    </button>
  );
}
