import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HoverCard } from "../ui/components/HoverCard";
import { isGlossaryKey } from "./glossary";

/**
 * A word of OpenSVC in a label, said on demand: underlined with dots, its
 * definition from the glossary in a card while hovered or focused, the keyboard
 * reaching it too. `term`, its glossary key; `children`, the label as shown, the
 * term's name when none. A key the glossary does not hold, the label alone.
 * `focusable` false in a button, a sort's say: said on hover only, the focus not
 * nested in the button's.
 */
export function Term({
  term,
  focusable = true,
  children,
}: {
  term: string;
  focusable?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!isGlossaryKey(term)) return <>{children ?? term}</>;
  return (
    <HoverCard
      focusable={focusable}
      card={
        <span className="block space-y-1" data-term-card={term}>
          <span className="block font-medium text-ink">{t(`glossary.terms.${term}.term`)}</span>
          <span className="block font-normal text-ink">{t(`glossary.terms.${term}.definition`)}</span>
          <span className="block font-normal text-ink-muted">{t("glossary.more")}</span>
        </span>
      }
    >
      <span data-term={term} className="cursor-help underline decoration-ink-muted decoration-dotted underline-offset-2">
        {children ?? t(`glossary.terms.${term}.term`)}
      </span>
    </HoverCard>
  );
}
