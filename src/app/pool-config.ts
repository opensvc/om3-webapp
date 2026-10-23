/*
 * A pool of the cluster, a `[pool#<name>]` section of the cluster configuration
 * (`section-config.ts`): what a pool asks beyond its keywords.
 */
import type { SectionRules } from "./section-config";

/**
 * What a pool asks beyond its keywords: the drbd peers reached at an address of each
 * node; where it takes its volumes from asked first, its filesystem after.
 */
export const POOL_RULES: SectionRules = {
  perNode: { drbd: ["addr"] },
  order: ["path", "name", "vg", "zpool", "array", "diskgroup", "srp", "rbd_pool", "template", "network", "fs_type", "mnt_opt", "mkfs_opt", "mkblk_opt"],
};
