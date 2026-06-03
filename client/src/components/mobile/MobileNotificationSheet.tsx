import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useNotifications } from "@/lib/notifications";
import NotificationList from "../NotificationList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full-screen notification center for the phone build. Reuses the shared
 * NotificationList (one data path across desktop popover / tablet popover /
 * mobile sheet); the sheet only supplies the full-bleed container + a title bar.
 */
export default function MobileNotificationSheet({ open, onOpenChange }: Props) {
  const { data: session, isPending } = useSession();
  const enabled = !isPending && !!session;
  const { data } = useNotifications(enabled);
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-foreground/40 duration-150 supports-backdrop-filter:backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col bg-background outline-none duration-200 data-open:animate-in data-open:slide-in-from-bottom motion-reduce:animate-none">
          <div className="flex-none border-b border-border pt-[env(safe-area-inset-top)]">
            <div className="flex h-[52px] items-center justify-between pl-[18px] pr-2">
              <span className="inline-flex items-baseline gap-2.5">
                <DialogPrimitive.Title className="display-serif text-[22px] text-foreground">
                  Notifications
                </DialogPrimitive.Title>
                {unreadCount > 0 && (
                  <span className="font-mono text-[11px] text-accent-ink">
                    {unreadCount} new
                  </span>
                )}
              </span>
              <DialogPrimitive.Close
                aria-label="Close"
                className="grid size-10 place-items-center rounded-md text-ink-2 transition-colors hover:bg-panel-2"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <NotificationList enabled={enabled} onClose={() => onOpenChange(false)} />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
