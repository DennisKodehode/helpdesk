import { Role } from "@helpdesk/core";
import { Shield, ShieldCheck } from "lucide-react";

// The role authority glyph. The two admin tiers are distinguished by shield
// *intensity*, not a new hue: Global admin gets a FILLED shield (an intensity
// step up), Admin keeps the stroked ShieldCheck, Agent has none. Shared by the
// roster badge/menu, the protected-owner marker, and the sidebar footers so
// they all speak the same badge language.
export function RoleShield({
  role,
  className = "size-3",
}: {
  role: Role;
  className?: string;
}) {
  if (role === Role.globalAdmin) {
    return <Shield className={`${className} fill-current`} aria-hidden />;
  }
  if (role === Role.admin) {
    return <ShieldCheck className={className} aria-hidden />;
  }
  return null;
}
