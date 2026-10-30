import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { FactName } from "../../app/statusboard";

/**
 * A policy of an object, in the one badge of its policies: its value alone, no icon.
 * The policy is named for screen readers, "ha" or "nodes order" alone not saying what
 * they are about.
 */
export function PolicyTag({ name, value, children }: { name: FactName; value: string; children?: ReactNode }) {
  const { t } = useTranslation();
  const label = t(`ui.policies.${name}`);
  return (
    <span
      data-policy={name}
      // After the first, a dot apart, drawn, not read.
      className="inline-flex items-center gap-1 whitespace-nowrap not-first:before:content-['·']"
    >
      <span className="sr-only">{label}: </span>
      {value}
      {children}
    </span>
  );
}
