import type { ReactNode } from "react";
import { HoverCard } from "../ui/components/HoverCard";

/**
 * A symbol of the state tables said on demand, as a word of OpenSVC is (`Term`): a
 * help cursor over it, what it means in a card once the pointer has stayed a moment,
 * or at once when clicked. `inert` in a button, the click being the button's: the
 * card shown by the hover alone.
 */
export function SymbolHelp({
  meaning,
  inert = false,
  children,
}: {
  meaning: string;
  inert?: boolean;
  children: ReactNode;
}) {
  return (
    <HoverCard inert={inert} card={<span data-symbol-card="">{meaning}</span>}>
      <span className="inline-flex cursor-help">{children}</span>
    </HoverCard>
  );
}
