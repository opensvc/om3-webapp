import React, {useState} from "react";
import {useTranslation} from "react-i18next";
import useEventStore from "../hooks/useEventStore.js";
import {nscfgOf} from "../app/namespace-usage";
import {createNamespaceConfig} from "../app/object-create";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Section} from "./NodePanel";
import NamespaceMetrics from "./NamespaceMetrics";
import ObjectConfig from "./ObjectConfig";

/**
 * The first tab of a namespace: the cpu and memory its objects use, object by object
 * (NamespaceMetrics). Its claims, and what it takes of each, are the second tab
 * (NamespaceClaims).
 */
export function NamespaceUsage({namespace}) {
    const {t} = useTranslation();
    return (
        <div className="space-y-6">
            <Section id={`namespace-objects-${namespace}`} title={t("namespaces.panel.byObject")}>
                <NamespaceMetrics namespace={namespace}/>
            </Section>
        </div>
    );
}

/**
 * The third tab of a namespace: its configuration object, the file and the tools
 * of an object configuration (ObjectConfig). A namespace without one is offered to
 * create it, empty: its claims and pg settings are then written in the file.
 */
export function NamespaceConfig({namespace}) {
    const {t} = useTranslation();
    const {path, key} = nscfgOf(namespace);
    const exists = useEventStore((s) => s.objectStatus?.[key] !== undefined || s.objectInstanceStatus?.[key] !== undefined);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    if (exists) return <ObjectConfig path={path} statusPath={key}/>;

    const create = async () => {
        setCreating(true);
        setError(null);
        // What came of it, the actions tray says; refused, it is said here too.
        try {
            const refused = await createNamespaceConfig(namespace);
            if (refused !== null) setError(refused.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-3">
            <p>{t("namespaces.panel.noConfig", {namespace})}</p>
            {error && <Alert tone="error">{t("namespaces.panel.createFailed", {message: error})}</Alert>}
            <Button size="sm" onClick={create} disabled={creating}>
                {creating ? t("namespaces.panel.creating") : t("namespaces.panel.create")}
            </Button>
        </div>
    );
}
