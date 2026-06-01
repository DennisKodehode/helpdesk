interface Props {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, eyebrow, description, action }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="space-y-2">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {/* Prototype page title is a fixed 52px; one small-screen fallback.
            Explicit tight leading — Tailwind's arbitrary `text-[Npx]` injects a
            1.5 line-height that otherwise overrides `.display-serif`'s 0.98,
            inflating the title's line box by ~20px. */}
        <h1 className="display-serif text-[34px] leading-[1.04] text-foreground md:text-[52px]">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
