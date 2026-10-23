import React, {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {NETWORK_RULES, isCidr, overlapping} from "../app/network-config";
import {SectionWizard} from "./SectionWizard";

/**
 * The wizard of a network (`SectionWizard`): its range checked an address range, said
 * when it overlaps that of another network. `networks`, those there are; `edit`, one
 * to modify.
 */
export function NetworkWizard({networks, nodes, edit, onClose, onSaved}) {
    const {t} = useTranslation();
    const validate = useCallback((values, others) => {
        const cidr = (values.network ?? "").trim();
        if (cidr === "") return {errors: {}, warnings: []};
        if (!isCidr(cidr)) return {errors: {network: t("networks.wizard.cidrInvalid")}, warnings: []};
        const overlaps = overlapping(cidr, others);
        return {errors: {}, warnings: overlaps.length > 0 ? [t("networks.wizard.overlaps", {networks: overlaps.join(", ")})] : []};
    }, [t]);
    return (
        <SectionWizard
            section="network"
            rules={NETWORK_RULES}
            prefix="networks.wizard"
            items={networks}
            nodes={nodes}
            edit={edit}
            validate={validate}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}
