import { Link } from "@/components/ui/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  to: string;
  label: string;
}

export default function BackLink({ to, label }: Props) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
      aria-label={label}
    >
      <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
