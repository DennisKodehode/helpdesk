import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import MobileTopbar from "./MobileTopbar";
import Sidebar from "./Sidebar";

/**
 * The 256px-sidebar layout. Rendered for the desktop tier (≥1280px) and, until
 * the bespoke mobile shell ships, also as the fallback below the tablet tier —
 * its internal `md:` breakpoints keep the hamburger topbar + drawer working at
 * phone widths.
 */
export default function DesktopShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger — body doesn't read it
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <MobileTopbar onMenuClick={() => setMobileNavOpen(true)} />
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="pt-14 md:pt-0 md:pl-64">{children}</div>
    </div>
  );
}
