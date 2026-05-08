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
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      aria-label={label}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
