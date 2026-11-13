import type { ReactNode } from "react";

export interface SegmentOption<V extends string> {
  value: V;
  /** Its name, for screen readers and as the tooltip: the segment shows its icon alone. */
  label: string;
  icon: ReactNode;
}

/**
 * One choice among a few, each an icon in a sunken frame, the one chosen raised
 * out of it: a view switch, say, Design or Text. Each segment is a toggle button,
 * pressed when chosen, named by `label`; `data-segment` carries its value.
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The name of the group. */
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-(--radius-control) border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          aria-label={option.label}
          title={option.label}
          data-segment={option.value}
          onClick={() => onChange(option.value)}
          className="grid h-6 w-8 cursor-pointer place-items-center rounded-[calc(var(--radius-control)-2px)] text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-(--focus-ring) aria-pressed:bg-surface-raised aria-pressed:text-ink aria-pressed:shadow-sm [&_svg]:h-4 [&_svg]:w-4"
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
