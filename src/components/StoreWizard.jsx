import React from "react";
import {STORE_RULES, storeSource} from "../app/store-config";
import {SectionWizard} from "./SectionWizard";

/**
 * The wizard of a store of the cluster configuration (`SectionWizard`). `stores`, those
 * there are, as the store list gives them: the names of those of the cluster
 * configuration taken, a sec's apart. `edit`, one to modify.
 */
export function StoreWizard({stores, nodes, edit, onClose, onSaved}) {
    const taken = stores
        .map((s) => (s.ref !== undefined ? storeSource(s.ref) : {kind: "cluster", name: s.name}))
        .filter((s) => s.kind === "cluster")
        .map((s) => ({name: s.name}));
    return (
        <SectionWizard
            section="store"
            rules={STORE_RULES}
            prefix="stores.wizard"
            items={taken}
            nodes={nodes}
            edit={edit}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}
