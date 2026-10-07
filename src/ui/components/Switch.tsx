/**
 * Switch for a boolean value.
 *
 * The state reads from the knob position as much as from the colour, and
 * `role="switch"` with `aria-checked` conveys it to assistive technologies: it does
 * not rely on colour alone. Disabled, it stays readable and serves as a display.
 */
export function Switch({
  checked,
  label,
  stateLabel,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  /** Name of the property, for the accessible label. */
  label: string;
  /** Label of the current state, announced and shown as a tooltip. */
  stateLabel: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label} : ${stateLabel}`}
      title={stateLabel}
      disabled={disabled}
      onClick={() => {
        onChange?.(!checked);
      }}
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
        checked ? "border-accent bg-accent" : "border-line bg-surface-sunken"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-3.5 w-3.5 rounded-full transition-transform ${
          checked
            ? "translate-x-[1.125rem] bg-accent-ink"
            : "translate-x-[0.1875rem] bg-line-strong"
        }`}
      />
    </button>
  );
}
