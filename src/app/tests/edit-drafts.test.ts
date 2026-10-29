import { describe, expect, test } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { clearEditDrafts, useEditDraft } from "../edit-drafts";

describe("the edits in progress of the configuration editors", () => {
  test("kept for the editor of the same key mounted again; forgotten once set back to null", () => {
    const first = renderHook(() => useEditDraft<string>("node\u0000n1"));
    expect(first.result.current[0]).toBeNull();
    act(() => first.result.current[1]("edited"));
    first.unmount();

    const again = renderHook(() => useEditDraft<string>("node\u0000n1"));
    expect(again.result.current[0]).toBe("edited");
    // Another thing edited: its own, none.
    expect(renderHook(() => useEditDraft<string>("node\u0000n2")).result.current[0]).toBeNull();
    act(() => again.result.current[1](null));
    again.unmount();
    expect(renderHook(() => useEditDraft<string>("node\u0000n1")).result.current[0]).toBeNull();
  });

  test("the key changed under the same editor: the edit of the new key, if any", () => {
    const hook = renderHook(({ key }) => useEditDraft<string>(key), { initialProps: { key: "a" } });
    act(() => hook.result.current[1]("of a"));
    hook.rerender({ key: "b" });
    expect(hook.result.current[0]).toBeNull();
    hook.rerender({ key: "a" });
    expect(hook.result.current[0]).toBe("of a");
  });

  test("all forgotten at a sign-out", () => {
    const hook = renderHook(() => useEditDraft<string>("x"));
    act(() => hook.result.current[1]("secret in clear"));
    hook.unmount();
    clearEditDrafts();
    expect(renderHook(() => useEditDraft<string>("x")).result.current[0]).toBeNull();
  });
});
