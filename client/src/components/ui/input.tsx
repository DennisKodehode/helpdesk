import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";

import { cn } from "@/lib/utils";

// These are structured, single-line fields (email, name, password, search,
// numbers) — none are prose, so spellcheck off by default (no red squiggle that
// renders an email almost unreadable). Pass `spellCheck` to override. Text color
// is set explicitly so it stays full-contrast inside portals (dialogs) too.
function Input({
  className,
  type,
  spellCheck = false,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      spellCheck={spellCheck}
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-transparent px-[13px] py-[10px] text-[14px] text-foreground transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-4 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-[var(--accent-tint)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
