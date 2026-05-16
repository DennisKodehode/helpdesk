interface Props {
  label: string;
  value: string;
  hint?: string;
}

export default function StatCard({ label, value, hint }: Props) {
  return (
    <div className="flex flex-col gap-2 px-5 py-5 xl:px-7 xl:py-7 2xl:px-9 2xl:py-9">
      <p className="label-meta transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground">
        {label}
      </p>
      <p className="display-serif tabular text-[44px] leading-none text-foreground xl:text-[56px] 2xl:text-[64px]">
        {value}
      </p>
      {hint && (
        <p className="font-mono text-[11px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}
