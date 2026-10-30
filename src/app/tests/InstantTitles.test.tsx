import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { InstantTitles } from "../InstantTitles";

const card = () => document.querySelector("[data-instant-title-card]");

/** A pointer event as a browser sends it: jsdom has no PointerEvent, a mouse event carries the target left for. */
function pointer(type: "pointerover" | "pointerout", target: Element, init: { relatedTarget?: Element; pointerType?: string } = {}) {
  const event = new MouseEvent(type, { bubbles: true, relatedTarget: init.relatedTarget ?? null });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "mouse" });
  act(() => {
    target.dispatchEvent(event);
  });
}

describe("InstantTitles", () => {
  test("a title hovered said at once in a card, the browser's own kept away meanwhile, put back after", () => {
    render(
      <>
        <InstantTitles />
        <button type="button" title={"Rescan\nwhat the node can run"}>
          <span>Rescan</span>
        </button>
        <span>elsewhere</span>
      </>,
    );
    const button = screen.getByRole("button", { name: "Rescan" });
    expect(card()).toBeNull();
    // Hovered by a child of it: its title said, no delay.
    pointer("pointerover", screen.getByText("Rescan"));
    expect(card()).toHaveTextContent("Rescan what the node can run");
    expect(card()).toHaveAttribute("role", "tooltip");
    expect(card()).toHaveClass("whitespace-pre-line");
    expect(button).not.toHaveAttribute("title");
    // From a child to it: still hovered.
    pointer("pointerout", screen.getByText("Rescan"), { relatedTarget: button });
    expect(card()).not.toBeNull();
    // Gone: the card hidden, the title back.
    pointer("pointerout", button, { relatedTarget: screen.getByText("elsewhere") });
    expect(card()).toBeNull();
    expect(button).toHaveAttribute("title", "Rescan\nwhat the node can run");
  });

  test("titles nested: the innermost said, those around it kept from the browser, each put back after", () => {
    render(
      <>
        <InstantTitles />
        <button type="button" title="Open the instance on n1">
          <span title="stopped">||</span>
          <span>idle</span>
        </button>
        <span>elsewhere</span>
      </>,
    );
    const button = screen.getByRole("button");
    const mark = screen.getByText("||");
    pointer("pointerover", mark);
    expect(card()).toHaveTextContent(/^stopped$/);
    // The button's title away too: the browser shows no second tooltip beside the card.
    expect(mark).not.toHaveAttribute("title");
    expect(button).not.toHaveAttribute("title");
    // From the mark to the rest of the button: the button's own said.
    pointer("pointerout", mark, { relatedTarget: screen.getByText("idle") });
    pointer("pointerover", screen.getByText("idle"));
    expect(card()).toHaveTextContent(/^Open the instance on n1$/);
    expect(mark).toHaveAttribute("title", "stopped");
    pointer("pointerout", button, { relatedTarget: screen.getByText("elsewhere") });
    expect(card()).toBeNull();
    expect(button).toHaveAttribute("title", "Open the instance on n1");
    expect(mark).toHaveAttribute("title", "stopped");
  });

  test("nothing for an element without a title, an empty one, or a touch", () => {
    render(
      <>
        <InstantTitles />
        <span>plain</span>
        <span title="  ">blank</span>
        <span title="said">touched</span>
      </>,
    );
    pointer("pointerover", screen.getByText("plain"));
    pointer("pointerover", screen.getByText("blank"));
    expect(card()).toBeNull();
    pointer("pointerover", screen.getByText("touched"), { pointerType: "touch" });
    expect(card()).toBeNull();
    expect(screen.getByText("touched")).toHaveAttribute("title", "said");
  });

  test("a click, a key or a scroll hides it; another element hovered says its own", () => {
    render(
      <>
        <InstantTitles />
        <span title="first">one</span>
        <span title="second">two</span>
      </>,
    );
    pointer("pointerover", screen.getByText("one"));
    pointer("pointerover", screen.getByText("two"));
    expect(card()).toHaveTextContent(/^second$/);
    expect(screen.getByText("one")).toHaveAttribute("title", "first");
    fireEvent.pointerDown(screen.getByText("two"));
    expect(card()).toBeNull();
    expect(screen.getByText("two")).toHaveAttribute("title", "second");
    pointer("pointerover", screen.getByText("one"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(card()).toBeNull();
    pointer("pointerover", screen.getByText("one"));
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(card()).toBeNull();
  });

  test("a title the page wrote while hovered kept, not the one set aside", () => {
    const { rerender } = render(
      <>
        <InstantTitles />
        <span title="old">it</span>
      </>,
    );
    pointer("pointerover", screen.getByText("it"));
    rerender(
      <>
        <InstantTitles />
        <span title="new">it</span>
      </>,
    );
    pointer("pointerout", screen.getByText("it"));
    expect(screen.getByText("it")).toHaveAttribute("title", "new");
  });
});
