import {describe, expect, test} from "vitest";
import {KEY_SOURCE, datastorePath, isKeyName, resolveSelf} from "../key-source";

describe("datastorePath, as om reads a path in the configuration of an object", () => {
    test.each([
        // Relative: of the namespace of the object.
        ["./cfg/foo", "dev/svc/oc3", "dev/cfg/foo"],
        ["./sec/ca", "dev/svc/oc3", "dev/sec/ca"],
        ["./usr/bob", "dev/svc/oc3", "dev/usr/bob"],
        ["./cfg/foo", "dev/vol/data", "dev/cfg/foo"],
        ["./cfg/foo", "dev/", "dev/cfg/foo"],
        // Of the root namespace, which the path of an object does not say.
        ["./cfg/foo", "bug1", "cfg/foo"],
        ["./cfg/foo", "vol/v1", "cfg/foo"],
        ["./cfg/foo", "root/svc/a", "cfg/foo"],
        ["./cfg/foo", "/", "cfg/foo"],
        // Two words are of the root namespace, whatever the namespace of the object.
        ["cfg/foo", "dev/svc/oc3", "cfg/foo"],
        ["sec/ca", "dev/svc/oc3", "sec/ca"],
        // Named in full.
        ["system/sec/ca", "dev/svc/oc3", "system/sec/ca"],
        ["root/cfg/foo", "dev/svc/oc3", "cfg/foo"],
        // Self.
        [".", "dev/cfg/oc3", "dev/cfg/oc3"],
        [".", "cfg/foo", "cfg/foo"],
    ])("%s in the configuration of %s is %s", (word, self, path) => {
        expect(datastorePath(word, self)).toBe(path);
    });

    test.each([
        [".", "dev/svc/oc3", "self, no datastore"],
        ["foo", "dev/svc/oc3", "a word is a svc"],
        ["./svc/foo", "dev/svc/oc3", "no datastore"],
        ["dev/svc/foo", "dev/svc/oc3", "no datastore"],
        ["./sec/haproxy-*", "dev/svc/oc3", "a pattern"],
        ["{env.ns}/cfg/foo", "dev/svc/oc3", "a reference only the node resolves"],
        ["a/b/cfg/foo", "dev/svc/oc3", "too many parts"],
        ["cfg/", "dev/svc/oc3", "the configuration of a namespace"],
        ["ns1/", "dev/svc/oc3", "the configuration of a namespace"],
    ])("%s in the configuration of %s names none: %s", (word, self) => {
        expect(datastorePath(word, self)).toBeUndefined();
    });
});

test("a key name, not a pattern nor a reference; its slashes are its own", () => {
    expect(isKeyName("relay.acme.com/user1/password")).toBe(true);
    expect(isKeyName("config.yaml")).toBe(true);
    expect(isKeyName("*")).toBe(false);
    expect(isKeyName("conf/*.yaml")).toBe(false);
    expect(isKeyName("{name}.yaml")).toBe(false);
});

test("found as om writes it, not inside a word", () => {
    expect("/etc/a from ./cfg/oc3 key a.yaml mode 0755".match(KEY_SOURCE).slice(4)).toEqual(["./cfg/oc3", " ", "key", " ", "a.yaml"]);
    expect("from system/sec/backup key ssh_private_key".match(KEY_SOURCE)[4]).toBe("system/sec/backup");
    expect("xfrom a key b".match(KEY_SOURCE)).toBeNull();
});

describe("the references to the object itself, which om resolves from it alone", () => {
    test("{name}, {namespace}, {kind}, {path} and their svc aliases, resolved", () => {
        expect(resolveSelf("./cfg/{name}", "ns1/svc/oc3")).toBe("./cfg/oc3");
        expect(resolveSelf("{namespace}/sec/{svcname}", "ns1/svc/oc3")).toBe("ns1/sec/oc3");
        expect(resolveSelf("{kind}-{path}-{svcpath}", "ns1/svc/oc3")).toBe("svc-ns1/svc/oc3-ns1/svc/oc3");
        expect(resolveSelf("./cfg/{name}", undefined)).toBe("./cfg/{name}");
    });

    test("the datastore and the key a line names through them, a way there", () => {
        expect(datastorePath("./cfg/{name}", "ns1/svc/oc3")).toBe("ns1/cfg/oc3");
        expect(datastorePath("./sec/{name}-tls", "ns1/svc/oc3")).toBe("ns1/sec/oc3-tls");
        expect(isKeyName("{name}.conf", "ns1/svc/oc3")).toBe(true);
    });

    test("what only the node resolves stays as written: another reference, a pattern", () => {
        expect(datastorePath("./cfg/{env.store}", "ns1/svc/oc3")).toBeUndefined();
        expect(datastorePath("./cfg/{name}-*", "ns1/svc/oc3")).toBeUndefined();
        expect(isKeyName("{nodename}.conf", "ns1/svc/oc3")).toBe(false);
        expect(isKeyName("conf/*", "ns1/svc/oc3")).toBe(false);
    });
});
