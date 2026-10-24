/*
 * A store, where the `sync.store` resources keep the backups of their objects: a
 * `[store#<name>]` section of the cluster configuration (`section-config.ts`), or one a
 * sec declares to the namespaces it serves.
 */
import type { SectionRules } from "./section-config";

/** What a store asks beyond its keywords: where it is first, how it is reached, then what it keeps. */
export const STORE_RULES: SectionRules = {
  order: ["url", "shared", "host_key", "ssh_private_key", "keep", "schedule"],
};

/**
 * Where a store is declared, from its reference: a store of the cluster configuration
 * by its name; one of a sec as `from <sec> store#<name>`.
 */
export type StoreSource = { kind: "cluster"; name: string } | { kind: "sec"; sec: string; name: string };

export function storeSource(ref: string): StoreSource {
  const match = /^from\s+(\S+)\s+store#(\S+)$/.exec(ref.trim());
  return match ? { kind: "sec", sec: match[1], name: match[2] } : { kind: "cluster", name: ref };
}
