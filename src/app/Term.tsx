import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HoverCard } from "../ui/components/HoverCard";
import { isGlossaryKey } from "./glossary";

/**
 * A word of OpenSVC in a label: a help cursor over it, its entry of the glossary in a
 * card once the pointer has stayed a moment, or at once when clicked. `term`, its
 * glossary key; `children`, the label as shown, the term's name when none. A key the
 * glossary does not hold, the label alone. `inert` in a button, a sort's say: the
 * click is the button's, the card shown by the hover alone.
 */
export function Term({
  term,
  inert = false,
  children,
}: {
  term: string;
  inert?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  if (!isGlossaryKey(term)) return <>{children ?? term}</>;
  return (
    <HoverCard
      inert={inert}
      card={
        <span className="block space-y-1" data-term-card={term}>
          <span className="block font-medium text-ink">{t(`glossary.terms.${term}.term`)}</span>
          <span className="block font-normal text-ink">{t(`glossary.terms.${term}.definition`)}</span>
          <span className="block font-normal text-ink-muted">{t("glossary.more")}</span>
        </span>
      }
    >
      <span data-term={term} className="cursor-help">
        {children ?? t(`glossary.terms.${term}.term`)}
      </span>
    </HoverCard>
  );
}
