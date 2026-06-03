import TabletIconRail from "./TabletIconRail";

/**
 * Tablet layout: the 76px icon rail beside a full-height scrolling main column.
 * No top bar — pages scroll inside `<main>` (the page's own PageContainer
 * provides padding/max-width, which renders full-bleed at the ~1118px tablet
 * content width).
 */
export default function TabletShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <TabletIconRail />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
