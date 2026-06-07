/** The page heading used inside mobile tab screens (serif title + sub). */
export default function MobileHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-5 pt-[18px] pb-3.5">
      <h1 className="display-serif text-[34px] text-foreground">{title}</h1>
      {sub && <p className="mt-2.5 text-[14px] leading-[1.45] text-ink-3">{sub}</p>}
    </div>
  );
}
