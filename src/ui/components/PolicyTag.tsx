import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FactName } from "../../app/statusboard";

/**
 * A policy of an object as muted text: its value alone, no icon nor pill. The policy is named for
 * screen readers, "ha" or "nodes order" alone not saying what
 * they are about.
 */
export function PolicyTag({ name, value, children }: { name: FactName; value: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const label = t(`ui.policies.${name}`);
  return (
    <span
      data-policy={name}
      // Muted text, no pill (a pill is a count filtering a page): after the first, a dot apart, drawn, not read.
      className="inline-flex items-center gap-1 whitespace-nowrap text-data text-ink-muted not-first:before:mr-0.5 not-first:before:content-['·']"
    >
      <span className="sr-only">{label}: </span>
      {value}
      {children}
    </span>
  );
}
