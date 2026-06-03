import Sidebar from "./Sidebar";

/**
 * The 256px-sidebar layout, rendered for the desktop tier (>=1280px). Tablet
 * and mobile have their own shells, so there's no hamburger/topbar here.
 */
export default function DesktopShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64">{children}</div>
    </div>
  );
}
