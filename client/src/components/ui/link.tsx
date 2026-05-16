import { type LinkProps, Link as RouterLink } from "react-router";
import { cn } from "@/lib/utils";

export function Link({ className, ...props }: LinkProps) {
  return <RouterLink className={cn("transition-colors", className)} {...props} />;
}
