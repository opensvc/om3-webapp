import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER, URL_NETWORK, URL_NETWORK_IP, URL_NODES} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {extractSection} from "../utils/configSections.js";
import {trackRefused, trackWrite} from "../app/action-tracker";
import {opsQuery} from "../app/namespace-claims";
import {useGrants} from "../hooks/useGrants";
import {refusalReason} from "./objectActions";
import {ConfigText} from "./ConfigText";
import {Alert} from "../ui/components/Alert";
import {Button, IconButton} from "../ui/components/Button";
import {Textarea} from "../ui/components/Field";
import {bodyOps, parseBody, sectionBody} from "../app/network-config";
import {NetworkWizard} from "./NetworkWizard";
import {Dialog} from "../ui/components/Dialog";
import {Spinner} from "../ui/components/Spinner";
import {usageState} from "../ui/components/UsageBar";
import {PencilIcon, SlidersIcon, TrashIcon} from "../ui/icons";
import {useClusterNodes} from "../hooks/usePgUsage";
import {NetworkSketch} from "./NetworkSketch";

const KEYWORDS_URL = `${URL_CLUSTER}/config/keywords`;

const headers = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

/** The answer of a read, its JSON or its text; an error said by the daemon thrown. */
async function read(url, as = "json") {
    const response = await fetch(url, {headers: headers()});
    if (!response.ok) throw new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
    return as === "json" ? response.json() : response.text();
}

/**
 * The section of a network in the cluster configuration, `[network#<name>]`: its text,
 * null for a network of none (the built-in `lo` and `default`), undefined while read.
 */
export function useNetworkSection(name) {
    const [state, setState] = useState({section: undefined, error: null});
    const [version, setVersion] = useState(0);
    useEffect(() => {
        let live = true;
        read(`${URL_CLUSTER}/config/file?redact-secrets=true`, "text").then(
            (text) => live && setState({section: extractSection(text, `network#${name}`), error: null}),
            (err) => live && setState({section: null, error: err.message}),
        );
        return () => {
            live = false;
        };
    }, [name, version]);
    const reload = useCallback(() => setVersion((v) => v + 1), []);
    return {...state, reload};
}

/**
 * A count of addresses, readable: one too large to be told exactly by a number (an
 * IPv6 range, 2^64 addresses) said as a power of two.
 */
export function formatCount(n, locale) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "–";
    if (n < 1e15) return n.toLocaleString(locale);
    return `≈ 2^${Math.round(Math.log2(n))}`;
}

const RING_RADIUS = 52;
const RING_STROKE = {up: "stroke-state-up", warn: "stroke-state-warn", down: "stroke-state-down"};

/**
 * The usage of a network as a ring, the gauge of its addresses gone round from the
 * top, in the colours of the usage bars; in it, the share used, how many are used and
 * how many free. A share too small to see still drawn, a sliver.
 */
export function UsageRing({used, size, free, label}) {
    const {t, i18n} = useTranslation();
    const pct = size ? (used / size) * 100 : 0;
    const round = 2 * Math.PI * RING_RADIUS;
    const length = used > 0 ? Math.max(2, (round * Math.min(pct, 100)) / 100) : 0;
    const state = usageState(pct);
    return (
        <div data-usage-ring={state} className="relative size-44">
            <svg viewBox="0 0 120 120" aria-hidden="true" className="size-full -rotate-90">
                <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-surface-sunken"/>
                {length > 0 && (
                    <circle
                        cx="60"
                        cy="60"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${length} ${round}`}
                        className={RING_STROKE[state]}
                    />
                )}
            </svg>
            <div role="group" aria-label={label} className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-semibold tabular-nums">{size ? `${pct.toFixed(1)}%` : "–"}</span>
                <span className="tabular-nums">{t("networks.panel.used", {count: used, value: formatCount(used, i18n.language)})}</span>
                <span className="text-ink-muted tabular-nums">{t("networks.panel.free", {count: free, value: formatCount(free, i18n.language)})}</span>
            </div>
        </div>
    );
}

/**
 * What a network hands out: its usage, as a ring, and its sketch, the addresses in
 * use on each node.
 */
export function NetworkOverview({name}) {
    const {t} = useTranslation();
    const [network, setNetwork] = useState(undefined);
    const [addresses, setAddresses] = useState(null);
    const [error, setError] = useState(null);
    const {section} = useNetworkSection(name);
    const storeNodes = useClusterNodes();
    const [clusterNodes, setClusterNodes] = useState(null);

    useEffect(() => {
        let live = true;
        read(`${URL_NETWORK}?name=${encodeURIComponent(name)}`).then(
            (data) => live && setNetwork((data.items ?? []).find((n) => n.name === name) ?? null),
            (err) => live && (setError(err.message), setNetwork(null)),
        );
        // The nodes of the cluster, all of them in the sketch, those holding no address too.
        read(URL_NODES).then(
            (data) => live && setClusterNodes((data.items ?? []).map((n) => n.meta?.node).filter(Boolean).sort()),
            () => live && setClusterNodes([]),
        );
        read(URL_NETWORK_IP).then(
            (data) => live && setAddresses((data.items ?? []).filter((ip) => ip.network?.name === name)),
            () => live && setAddresses([]),
        );
        return () => {
            live = false;
        };
    }, [name]);

    // The nodes of the sketch: those of the cluster; unread, those the page knows, or those holding addresses.
    const sketchNodes = useMemo(() => {
        if (clusterNodes?.length) return clusterNodes;
        if (storeNodes.length) return storeNodes;
        return [...new Set((addresses ?? []).map((ip) => ip.node).filter(Boolean))].sort();
    }, [clusterNodes, storeNodes, addresses]);

    if (network === undefined) return <Spinner label={t("networks.panel.loading")}/>;
    if (network === null) return <Alert tone="error">{error ? t("networks.panel.readFailed", {message: error}) : t("networks.panel.none", {name})}</Alert>;

    return (
        <div className="space-y-5">
            {/* Its type and range in the band of the sketch. */}
            <section aria-labelledby={`network-usage-${name}`} className="space-y-2">
                <h3 id={`network-usage-${name}`} className="font-semibold">{t("networks.panel.usage")}</h3>
                <UsageRing used={network.used ?? 0} size={network.size} free={network.free ?? 0} label={t("networks.usageOf", {name})}/>
            </section>

            {addresses !== null && section !== undefined && clusterNodes !== null && (
                <section aria-labelledby={`network-sketch-${name}`} className="space-y-2">
                    <h3 id={`network-sketch-${name}`} className="font-semibold">{t("networks.sketch.title")}</h3>
                    <NetworkSketch network={network} section={section} nodes={sketchNodes} addresses={addresses}/>
                </section>
            )}

        </div>
    );
}

/**
 * The delete of a network, root only: a tool removing its section of the cluster
 * configuration, confirmed first, said how many addresses it still hands out, read
 * when asked.
 */
function NetworkDelete({name, onDeleted}) {
    const {t} = useTranslation();
    const [confirming, setConfirming] = useState(false);
    const [used, setUsed] = useState(0);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState(null);

    const ask = () => {
        setDeleteError(null);
        setUsed(0);
        setConfirming(true);
        read(`${URL_NETWORK}?name=${encodeURIComponent(name)}`).then(
            (data) => setUsed((data.items ?? []).find((n) => n.name === name)?.used ?? 0),
            () => {},
        );
    };

    const remove = useCallback(async () => {
        const write = {action: "config", label: t("networks.panel.tray", {name}), subject: name};
        setDeleting(true);
        setDeleteError(null);
        try {
            const response = await fetch(`${URL_CLUSTER}/config?${opsQuery({delete: [`network#${name}`]})}`, {method: "PATCH", headers: headers()});
            const ok = await trackWrite(response, write, async (r) => {
                const detail = await getResponseErrorMessage(r);
                setDeleteError(detail || `HTTP ${r.status}`);
                return refusalReason({status: r.status, detail});
            });
            if (ok) {
                setConfirming(false);
                onDeleted?.(name);
            }
        } catch (err) {
            trackRefused({...write, reason: err.message});
            setDeleteError(err.message);
        } finally {
            setDeleting(false);
        }
    }, [name, onDeleted, t]);

    return (
        <>
            <IconButton tone="delete" label={t("networks.panel.delete")} onClick={ask}>
                <TrashIcon/>
            </IconButton>
            <Dialog
                open={confirming}
                size="sm"
                title={t("networks.panel.confirmTitle", {name})}
                onClose={() => !deleting && setConfirming(false)}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setConfirming(false)} disabled={deleting}>{t("common.cancel")}</Button>
                        <Button variant="delete" onClick={remove} disabled={deleting}>
                            {deleting ? t("networks.panel.deleting") : t("networks.panel.delete")}
                        </Button>
                    </>
                )}
            >
                <div className="space-y-3">
                    <p>{t("networks.panel.confirmText", {name})}</p>
                    {used > 0 && <Alert tone="warning">{t("networks.panel.inUse", {count: used})}</Alert>}
                    {deleteError && <Alert tone="error">{t("networks.panel.deleteFailed", {message: deleteError})}</Alert>}
                </div>
            </Dialog>
        </>
    );
}

/**
 * The section of a network in the cluster configuration, each key with its help; a
 * built-in one said so. Root edits it in place, its lines but its header: written as
 * the keys changed set and those gone unset, in one write, the rest of the file left
 * alone; a section changed since the edit started not overwritten. Root modifies it
 * in the wizard too, and deletes it (`onDeleted`, then).
 */
export function NetworkConfig({name, onDeleted}) {
    const {t} = useTranslation();
    const isRoot = Object.prototype.hasOwnProperty.call(useGrants(), "root");
    const {section, error, reload} = useNetworkSection(name);
    const [edit, setEdit] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState(null);
    const header = `[network#${name}]`;

    // The section as stored, its secrets in clear: what an edit starts from and is checked against.
    const readBody = async () => sectionBody(extractSection(await read(`${URL_CLUSTER}/config/file?redact-secrets=false`, "text"), `network#${name}`));

    // The wizard seeded with the section as stored, the networks and the nodes it checks against.
    const [wizard, setWizard] = useState(null);
    const startWizard = async () => {
        setEditError(null);
        try {
            const [text, list, nodeList] = await Promise.all([
                read(`${URL_CLUSTER}/config/file?redact-secrets=false`, "text"),
                read(URL_NETWORK),
                read(URL_NODES),
            ]);
            setWizard({
                values: parseBody(sectionBody(extractSection(text, `network#${name}`))).values,
                networks: list.items ?? [],
                nodes: (nodeList.items ?? []).map((n) => n.meta?.node).filter(Boolean).sort(),
            });
        } catch (err) {
            setEditError(t("networks.panel.readFailed", {message: err.message}));
        }
    };

    const startEdit = async () => {
        setEditError(null);
        try {
            const body = await readBody();
            setEdit({base: body, text: body});
        } catch (err) {
            setEditError(t("networks.panel.readFailed", {message: err.message}));
        }
    };

    const save = async () => {
        const ops = bodyOps(name, edit.base, edit.text);
        if (ops.invalid.length > 0) {
            setEditError(t("networks.panel.invalidLines", {lines: ops.invalid.join(" · ")}));
            return;
        }
        const write = {action: "config", label: t("networks.panel.trayEdit", {name}), subject: name};
        setSaving(true);
        setEditError(null);
        try {
            if ((await readBody()) !== edit.base) {
                setEditError(t("config.feedback.conflict"));
                return;
            }
            const response = await fetch(`${URL_CLUSTER}/config?${opsQuery({set: ops.set, unset: ops.unset})}`, {method: "PATCH", headers: headers()});
            const ok = await trackWrite(response, write, async (r) => {
                const detail = await getResponseErrorMessage(r);
                setEditError(t("config.feedback.updateFailed", {message: detail || `HTTP ${r.status}`}));
                return refusalReason({status: r.status, detail});
            });
            if (ok) {
                setEdit(null);
                reload();
            }
        } catch (err) {
            trackRefused({...write, reason: err.message});
            setEditError(t("config.feedback.updateFailed", {message: err.message}));
        } finally {
            setSaving(false);
        }
    };

    if (error) return <Alert tone="error">{t("networks.panel.readFailed", {message: error})}</Alert>;
    if (section === undefined) return <Spinner/>;

    if (edit !== null) {
        const ops = bodyOps(name, edit.base, edit.text);
        const unchanged = ops.set.length === 0 && ops.unset.length === 0 && ops.invalid.length === 0;
        return (
            <div className="space-y-2">
                {editError && <Alert tone="error">{editError}</Alert>}
                {/* The header fixed: the name of the network is not edited here. */}
                <p className="font-mono text-data text-ink-muted">{header}</p>
                <Textarea
                    aria-label={t("networks.panel.configOf", {name})}
                    value={edit.text}
                    onChange={(e) => setEdit({...edit, text: e.target.value})}
                    disabled={saving}
                    spellCheck={false}
                    rows={Math.min(30, Math.max(8, edit.text.split("\n").length + 1))}
                    className="font-mono text-data whitespace-pre"
                />
                <p className="text-data text-ink-muted">{t("networks.panel.editHint")}</p>
                <div className="flex justify-end gap-2">
                    <Button onClick={() => {
                        setEdit(null);
                        setEditError(null);
                    }} disabled={saving}>{t("common.cancel")}</Button>
                    <Button onClick={save} disabled={saving || unchanged}
                            icon={saving ? <Spinner label={t("config.view.saving")}/> : undefined}>
                        {t("common.save")}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {isRoot && (
                <div className="flex items-center justify-end gap-1">
                    {/* A network of a section of its own: modified in the wizard, seeded with it. */}
                    {section && (
                        <IconButton label={t("networks.panel.modify", {name})} onClick={startWizard}>
                            <SlidersIcon/>
                        </IconButton>
                    )}
                    <IconButton label={t("networks.panel.edit", {name})} onClick={startEdit}>
                        <PencilIcon/>
                    </IconButton>
                    {/* A built-in network has no section to delete. */}
                    {section && <NetworkDelete name={name} onDeleted={onDeleted}/>}
                </div>
            )}
            {wizard && (
                <NetworkWizard
                    networks={wizard.networks}
                    nodes={wizard.nodes}
                    edit={{name, values: wizard.values}}
                    onClose={() => setWizard(null)}
                    onSaved={() => {
                        setWizard(null);
                        reload();
                    }}
                />
            )}
            {editError && <Alert tone="error">{editError}</Alert>}
            {section === null
                ? <p className="text-ink-muted">{t("networks.panel.builtIn", {name})}</p>
                : <ConfigText text={section} keywordsUrl={KEYWORDS_URL} label={t("networks.panel.configOf", {name})}/>}
        </div>
    );
}
