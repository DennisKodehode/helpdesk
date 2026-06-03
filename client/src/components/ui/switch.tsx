import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

// 42×24 track with an 18px knob, matching the Workflow design spec: violet
// accent track + white knob when on, panel-2 track + ink-4 knob when off. The
// knob slide uses the spec's springy cubic-bezier. Controlled via
// `checked` / `onCheckedChange` (Base UI). `bg-primary` is this design system's
// violet accent (see index.css: --primary = --accent-solid).
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full border outline-none transition-colors",
        "border-hairline-strong bg-panel-2",
        "data-checked:border-primary data-checked:bg-primary",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[18px] translate-x-[3px] rounded-full bg-ink-4 shadow-sm transition-[transform,background-color] duration-[160ms] ease-[cubic-bezier(.4,1.3,.6,1)] data-checked:translate-x-[21px] data-checked:bg-white" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
