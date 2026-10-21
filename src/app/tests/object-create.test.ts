import { afterEach, describe, expect, test, vi } from "vitest";
import { createNamespaceConfig, objectPath, pathErrors, withId } from "../object-create";
import { useActionTracker } from "../action-tracker";

describe("the path of a new object, as om checks it", () => {
  test("a valid path has no error, the root namespace by default", () => {
    expect(pathErrors("ns1", "svc", "web-1")).toEqual({});
    expect(pathErrors("", "cfg", "settings")).toEqual({});
    expect(pathErrors("root", "svc", "2.web")).toEqual({});
  });

  test.each([
    ["Web", "uppercase"],
    ["", "empty"],
    ["-web", "firstChar"],
    ["web_1", "chars"],
    ["a".repeat(64), "tooLong"],
    ["node", "reserved"],
    ["sec", "reserved"],
  ])("the name %s is refused: %s", (name, error) => {
    expect(pathErrors("ns1", "svc", name).name).toBe(error);
  });

  test("namespace is a svc name the root namespace keeps; elsewhere it is free", () => {
    expect(pathErrors("root", "svc", "namespace").name).toBe("reservedRoot");
    expect(pathErrors("ns1", "svc", "namespace")).toEqual({});
  });

  test("the namespace follows the same rules", () => {
    expect(pathErrors("NS", "svc", "web").namespace).toBe("uppercase");
    expect(pathErrors("ns.1_", "svc", "web").namespace).toBe("chars");
  });

  test("a namespace configuration has its name from om: none is checked", () => {
    expect(pathErrors("ns1", "nscfg", "")).toEqual({});
  });
});

describe("objectPath", () => {
  test.each([
    ["ns1", "svc", "web", "ns1/svc/web"],
    ["root", "svc", "web", "web"],
    ["", "svc", "web", "web"],
    ["root", "cfg", "settings", "cfg/settings"],
    ["ns1", "nscfg", "", "ns1/nscfg/namespace"],
  ])("%s %s %s is %s", (namespace, kind, name, path) => {
    expect(objectPath(namespace, kind, name)).toBe(path);
  });
});

describe("withId", () => {
  test("an empty configuration gets its DEFAULT section and the id", () => {
    expect(withId("", "abc")).toBe("[DEFAULT]\nid = abc\n");
  });

  test("the id of a copied object is replaced, the rest kept", () => {
    const config = "[DEFAULT]\nid = old\nnodes = *\n\n[fs#1]\nid = not-the-object-id\n";
    expect(withId(config, "new")).toBe("[DEFAULT]\nid = new\nnodes = *\n\n[fs#1]\nid = not-the-object-id\n");
  });

  test("a DEFAULT section without an id gets one", () => {
    expect(withId("[fs#1]\ntype = flag\n\n[DEFAULT]\nnodes = *\n", "abc")).toBe(
      "[fs#1]\ntype = flag\n\n[DEFAULT]\nid = abc\nnodes = *\n",
    );
  });

  test("a configuration without a DEFAULT section gets one first", () => {
    expect(withId("[fs#1]\ntype = flag\n", "abc")).toBe("[DEFAULT]\nid = abc\n\n[fs#1]\ntype = flag\n");
  });
});

describe("createNamespaceConfig", () => {
  const tray = () => useActionTracker.getState().tracked.map((e) => [e.label, e.subject, e.state, e.error ?? null]);
  afterEach(() => {
    useActionTracker.setState({ tracked: [], revealed: 0 });
    vi.restoreAllMocks();
  });

  test("created, said done in the actions tray", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await createNamespaceConfig("ns2")).toBeNull();
    expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("/api/object/path/ns2/nscfg/namespace/config/file");
    expect(tray()).toEqual([["Create the configuration of the namespace", "ns2", "succeeded", null]]);
  });

  test("refused, said with the daemon's reason, and answered for the caller to say it too", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: "exists" }), { status: 409 })));
    expect(await createNamespaceConfig("ns2")).toEqual({ status: 409, message: "exists" });
    expect(tray()).toEqual([["Create the configuration of the namespace", "ns2", "refused", "HTTP 409 exists"]]);
  });

  test("not sent, said in the tray, thrown for the caller", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error("offline")));
    await expect(createNamespaceConfig("ns2")).rejects.toThrow("offline");
    expect(tray()).toEqual([["Create the configuration of the namespace", "ns2", "refused", "offline"]]);
  });
});
