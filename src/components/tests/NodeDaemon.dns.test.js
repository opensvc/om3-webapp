import {describe, expect, test} from "vitest";
import {dnsRecordsOf} from "../NodeDaemon";

describe("the records of a dns dump", () => {
    const RECORD = {qname: "oc3.ns1.svc.dev2", qtype: "A", ttl: 60, content: "10.22.0.5", domain_id: 1};

    test("a list of them, as a node answers it", () => {
        expect(dnsRecordsOf({kind: "DNSRecordList", items: [RECORD]})).toEqual([RECORD]);
    });

    test("the bare array an older node answers", () => {
        expect(dnsRecordsOf([RECORD])).toEqual([RECORD]);
    });

    test("none, while read or when the answer holds none, the same empty list each time", () => {
        expect(dnsRecordsOf(undefined)).toEqual([]);
        expect(dnsRecordsOf(null)).toEqual([]);
        expect(dnsRecordsOf({kind: "DNSRecordList", items: []})).toEqual([]);
        expect(dnsRecordsOf(undefined)).toBe(dnsRecordsOf({}));
    });
});
