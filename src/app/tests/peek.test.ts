import { describe, expect, test } from "vitest";
import {
  parseStep,
  serialiseStep,
  stepIcon,
  stepLabel,
} from "../peek";

describe("peek steps", () => {
  test("a step is its kind, then its id, colons included", () => {
    expect(parseStep("object:ns1/svc/web")).toEqual({ kind: "object", id: "ns1/svc/web" });
    expect(parseStep("network:fe80::1")).toEqual({ kind: "network", id: "fe80::1" });
    expect(serialiseStep({ kind: "namespace", id: "ns1" })).toBe("namespace:ns1");
  });

  test.each([undefined, "", "object", ":x", "object:", "disk:x", "instance:n1/ns1/svc/web"])("%s is no step", (raw) => {
    expect(parseStep(raw)).toBeNull();
  });

  test("a record shows the icon of its kind, an object the one of its object kind", () => {
    expect(stepIcon({ kind: "object", id: "ns1/sec/key" })).toBe("secret");
    expect(stepIcon({ kind: "object", id: "ns1/svc/web" })).toBe("service");
    expect(stepIcon({ kind: "object", id: "vol/data" })).toBe("disk");
    expect(stepIcon({ kind: "network", id: "lo" })).toBe("network");
  });

  test("a record is named by its id", () => {
    expect(stepLabel({ kind: "object", id: "ns1/svc/web" })).toBe("ns1/svc/web");
  });
});
