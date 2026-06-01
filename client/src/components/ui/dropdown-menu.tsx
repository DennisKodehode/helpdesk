import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />;
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  children,
  ...props
}: MenuPrimitive.Popup.Props & {
  sideOffset?: number;
  align?: MenuPrimitive.Positioner.Props["align"];
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        sideOffset={sideOffset}
        align={align}
        className="z-50 outline-none"
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-content"
          className={cn(
            "min-w-[168px] origin-[var(--transform-origin)] overflow-hidden rounded-[var(--r-md)] border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-lg)] outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-item"
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-[var(--r-xs)] px-3 py-2 text-[13.5px] outline-none select-none data-highlighted:bg-panel-2",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      className={cn("my-1 h-px bg-[var(--hairline)]", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
