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
        <h1 className="display-serif text-[44px] leading-[1.05] tracking-[-0.015em] text-foreground">
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
