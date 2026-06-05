interface Props {
  archived: boolean;
  onChange: (archived: boolean) => void;
}

const TABS = [
  { key: "active", label: "Active" },
  { key: "archive", label: "Archive" },
] as const;

// Active | Archive segmented control for the tickets queue. Active = the working
// queue (non-closed); Archive = closed/"done" tickets. Mirrors the Activity-page
// tab toggle.
export default function ScopeToggle({ archived, onChange }: Props) {
  const active = archived ? "archive" : "active";
  return (
    <div
      role="tablist"
      aria-label="Ticket scope"
      className="inline-flex rounded-[var(--r-sm)] border border-border bg-panel-2 p-1"
    >
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={active === key}
          onClick={() => onChange(key === "archive")}
          className={`rounded-[6px] px-3 py-1.5 text-[13px] transition-colors ${
            active === key
              ? "bg-card font-semibold text-foreground shadow-[var(--shadow-sm)]"
              : "text-ink-3 hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
