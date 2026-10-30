import React from "react";
import {useTranslation} from "react-i18next";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";

/**
 * The refusals of a configuration write, in the daemon's words; written anyway on
 * demand when force lifts them, by whom it may: root, or anyone for a creation
 * over an object that exists (app/config-write forceLifts). `lifts` the strictest
 * of the refusals, null when force changes nothing of them.
 */
export function ForceRefusal({messages, lifts, isRoot, onForce, disabled, forceLabel}) {
    const {t} = useTranslation();
    if (!messages || messages.length === 0) return null;
    const canForce = lifts === "anyone" || (lifts === "root" && isRoot);
    return (
        <Alert
            action={canForce && (
                <Button size="sm" variant="delete" onClick={onForce} disabled={disabled}>
                    {forceLabel ?? t("configWrite.force.button")}
                </Button>
            )}
        >
            {messages.length === 1 ? messages[0] : (
                <ul className="list-disc pl-4">{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
            )}
            {lifts === "root" && !isRoot && <p className="mt-1">{t("configWrite.force.rootOnly")}</p>}
        </Alert>
    );
}
