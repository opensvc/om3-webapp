import { useLayoutEffect, type RefObject } from "react";

/*
 * Where a card shown on hover goes across the window: under what it is about, its
 * left edge on that of the element; not fitting, its right edge on the element's,
 * as near the element as the window leaves room. By the width the card has, not
 * the most it may take: a card narrower than that, about an element near the right
 * edge of the window, would otherwise be pushed left, under another element, the
 * same place for every element there.
 */

/** Room kept between a card and the edges of the window. */
export const CARD_MARGIN = 8;

/** The edges of the element a card is about, across the window. */
export interface CardAnchor {
  left: number;
  right: number;
}

/** The left of a card `width` wide about `anchor`, in a window `room` wide. */
export function cardLeft(anchor: CardAnchor, width: number, room: number): number {
  const left = anchor.left + width <= room - CARD_MARGIN ? anchor.left : anchor.right - width;
  return Math.max(CARD_MARGIN, Math.min(left, room - width - CARD_MARGIN));
}

/**
 * Places the card drawn by `card` about `anchor`, once drawn and before it is
 * painted: its width known. None shown, `anchor` null.
 */
export function usePlaceCard(card: RefObject<HTMLElement | null>, anchor: CardAnchor | null) {
  useLayoutEffect(() => {
    const element = card.current;
    if (element === null || anchor === null) return;
    element.style.left = `${cardLeft(anchor, element.offsetWidth, window.innerWidth)}px`;
  }, [card, anchor]);
}
