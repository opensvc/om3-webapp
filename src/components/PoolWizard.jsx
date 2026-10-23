import React from "react";
import {POOL_RULES} from "../app/pool-config";
import {SectionWizard} from "./SectionWizard";

/** The wizard of a pool (`SectionWizard`). `pools`, those there are; `edit`, one to modify. */
export function PoolWizard({pools, nodes, edit, onClose, onSaved}) {
    return (
        <SectionWizard
            section="pool"
            rules={POOL_RULES}
            prefix="pools.wizard"
            items={pools}
            nodes={nodes}
            edit={edit}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}
