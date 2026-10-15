import React, {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import useEventStore from "../hooks/useEventStore.js";
import {URL_OBJECT} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {useNamespaceClaims, useNamespacePg} from "../hooks/useNamespaceUsage";
import {computeLimit, formatCpu, networkUsage, nscfgOf, poolUsage} from "../app/namespace-usage";
import {newId, withId} from "../app/object-create";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {UsageBar} from "../ui/components/UsageBar";
import {Sparkline} from "../ui/components/Sparkline";
import {formatBytes} from "../ui/lib/format";
import {DataTable, Section} from "./NodePanel";
import NamespaceMetrics from "./NamespaceMetrics";
import ObjectConfig from "./ObjectConfig";

const last = (values) => (values?.length ? values[values.length - 1] : undefined);
const authHeaders = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

/**
 * What a namespace claims and takes of the cluster, a line each: every claim of its
 * configuration, and the pools and networks it uses without claiming of them, out
 * of their size then. The cpu and memory are the usage now, against the claimed cap.
 */
function claimLines(namespace, claims, pg) {
    const own = claims.claims[namespace] ?? [];
    const lines = [];
    for (const [type, usage] of [
        ["pool", poolUsage(namespace, claims.poolsHeld, claims.pools, own)],
        ["network", networkUsage(namespace, claims.networksHeld, claims.networks, own)],
    ]) {
        for (const s of usage.segments) lines.push({type, name: s.name, used: s.used, limit: s.total, claimed: s.claimed});
    }
    for (const type of ["cpu", "memory"]) {
        const limit = computeLimit(own, type);
        const used = last(pg[namespace]?.[type]);
        if (limit !== undefined || used !== undefined) {
            lines.push({type, used, limit, claimed: limit !== undefined, series: pg[namespace]?.[type] ?? []});
        }
    }
    return lines;
}

/**
 * The first tab of a namespace: its claims, what it takes of each and what is left,
 * then the cpu and memory its objects use, object by object (NamespaceMetrics).
 */
export function NamespaceUsage({namespace}) {
    const {t, i18n} = useTranslation();
    const locale = i18n.language;
    const namespaces = useMemo(() => [namespace], [namespace]);
    const claims = useNamespaceClaims(namespaces);
    const pg = useNamespacePg();
    const lines = claimLines(namespace, claims, pg);
    const hasClaims = (claims.claims[namespace] ?? []).length > 0;

    const amount = (line, value) => {
        if (value === undefined) return "–";
        if (line.type === "pool" || line.type === "memory") return value > 0 ? formatBytes(value, locale) : "0";
        if (line.type === "cpu") return formatCpu(value, locale);
        return value.toLocaleString(locale);
    };

    return (
        <div className="space-y-6">
            <Section id={`namespace-claims-${namespace}`} title={t("namespaces.panel.claims")}>
                {claims.error && <Alert tone="error">{t("namespaces.usage.error", {message: claims.error})}</Alert>}
                {claims.loaded && !hasClaims && <p className="text-ink-muted">{t("namespaces.panel.noClaim")}</p>}
                <DataTable
                    label={t("namespaces.panel.claims")}
                    rowKey={(line) => `${line.type}:${line.name ?? ""}`}
                    rows={lines}
                    empty={claims.loaded ? t("namespaces.panel.nothing") : t("nodePanel.loading")}
                    columns={[
                        {key: "type", label: t("namespaces.panel.resource"), className: "font-medium", render: (line) => (
                            <span className="whitespace-nowrap">
                                {t(`namespaces.panel.types.${line.type}`)}
                                {line.name && <span className="ml-1.5 font-mono text-data">{line.name}</span>}
                            </span>
                        )},
                        {key: "used", label: t("namespaces.usage.used"), numeric: true, render: (line) => amount(line, line.used)},
                        {key: "limit", label: t("namespaces.panel.limit"), numeric: true, render: (line) => (line.claimed
                            ? amount(line, line.limit)
                            : line.limit === undefined
                                ? t("namespaces.usage.noClaim")
                                : t("namespaces.panel.sizeOf", {size: amount(line, line.limit), of: t(`namespaces.panel.sizeOfType.${line.type}`)}))},
                        {key: "share", label: t("namespaces.panel.share"), render: (line) => (line.limit > 0 && line.used !== undefined
                            ? <UsageBar value={(line.used / line.limit) * 100} label={t("namespaces.panel.shareOf", {name: line.name ?? t(`namespaces.panel.types.${line.type}`)})}/>
                            : <span className="text-ink-muted">–</span>)},
                        {key: "free", label: t("namespaces.usage.free"), numeric: true, render: (line) => (line.limit > 0
                            ? amount(line, Math.max(0, line.limit - (line.used ?? 0)))
                            : "–")},
                        {key: "trend", label: t("namespaces.panel.trend"), render: (line) => (line.series
                            ? <Sparkline values={line.series} max={line.limit} label={t(`namespaces.${line.type}.trend`, {namespace})}/>
                            : null)},
                    ]}
                />
                <p className="text-ink-muted">{t("namespaces.panel.pgNode")}</p>
            </Section>
            <Section id={`namespace-objects-${namespace}`} title={t("namespaces.panel.byObject")}>
                <NamespaceMetrics namespace={namespace}/>
            </Section>
        </div>
    );
}

/**
 * The second tab of a namespace: its configuration object, the file and the tools
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
        try {
            const response = await fetch(`${URL_OBJECT}/${encodeURIComponent(namespace)}/nscfg/namespace/config/file`, {
                method: "POST",
                headers: {...authHeaders(), "Content-Type": "application/octet-stream"},
                body: withId("", newId()),
            });
            if (!response.ok) setError((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
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
