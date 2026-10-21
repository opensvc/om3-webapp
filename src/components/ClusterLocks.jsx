import React, {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {trackDone, trackRefused} from "../app/action-tracker";
import {refusalReason} from "./objectActions";
import {CrossLink} from "../app/CrossLink";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {Spinner} from "../ui/components/Spinner";
import {RelativeTime} from "../ui/components/RelativeTime";
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {RefreshIcon} from "../ui/icons";

/*
 * The cluster locks, as `om cluster lock list` shows them: the ones the node
 * speaking for the cluster granted, whose holder has neither released them nor
 * seen their lease end; each released on demand, as `om cluster lock release`
 * does. Root reads and releases them. No event tells a lock taken or released:
 * read again every few seconds while shown.
 */

/** How often the locks are read again while shown. */
export const LOCKS_EVERY_MS = 5000;

const URL_LOCKS = `${URL_CLUSTER}/lock`;
const headers = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

const UNITS = {h: 3_600_000, m: 60_000, s: 1000, ms: 1, us: 0.001, "µs": 0.001, ns: 0.000001};

/** A Go duration ("29.5s", "1m30s", "250ms") in milliseconds; null when it reads as none. */
export function durationMs(text) {
    if (typeof text !== "string" || text === "") return null;
    const parts = [...text.matchAll(/(\d+(?:\.\d+)?)(h|ms|us|µs|ns|m|s)/g)];
    if (parts.length === 0 || parts.map((p) => p[0]).join("") !== text.replace(/^-/, "")) return null;
    const ms = parts.reduce((sum, [, value, unit]) => sum + Number(value) * UNITS[unit], 0);
    return text.startsWith("-") ? -ms : ms;
}

/** The seconds left, rounded up: "12 s", "2 min 5 s". */
const left = (ms, t) => {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    return minutes > 0
        ? t("clusterLocks.leftMinutes", {minutes, seconds: seconds % 60})
        : t("clusterLocks.leftSeconds", {seconds});
};

export function ClusterLocks() {
    const {t, i18n} = useTranslation();
    // The locks read, each with the moment its lease ends on the clock of this page.
    const [locks, setLocks] = useState(null);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => Date.now());
    // The lock to release, waiting for its confirmation.
    const [releasing, setReleasing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [reads, setReads] = useState(0);
    const reload = useCallback(() => setReads((n) => n + 1), []);

    useEffect(() => {
        let live = true;
        const read = async () => {
            try {
                const response = await fetch(URL_LOCKS, {headers: headers(), cache: "no-cache"});
                if (!live) return;
                if (!response.ok) {
                    const detail = await getResponseErrorMessage(response);
                    if (!live) return;
                    setError(response.status === 403 ? t("clusterLocks.forbidden") : refusalReason({status: response.status, detail}));
                    return;
                }
                const body = await response.json();
                if (!live) return;
                const readAt = Date.now();
                // Rebased on this clock from the lease left, as the nodes do: the clocks need not agree.
                setLocks((body?.items ?? []).map((lock) => {
                    const lease = durationMs(lock.expires_in);
                    return {...lock, endsAt: lease === null ? Date.parse(lock.expires_at) : readAt + lease};
                }).sort((a, b) => a.name.localeCompare(b.name)));
                // Counted down from the moment read, not from the last tick before it.
                setNow(readAt);
                setError("");
            } catch (err) {
                if (live) setError(err.message);
            }
        };
        void read();
        const timer = setInterval(read, LOCKS_EVERY_MS);
        return () => {
            live = false;
            clearInterval(timer);
        };
    }, [reads, t]);

    // The leases counted down between two reads.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const release = async () => {
        const lock = releasing;
        setReleasing(null);
        setBusy(true);
        const info = {action: "release", label: t("clusterLocks.release"), subject: t("clusterLocks.subject", {name: lock.name})};
        try {
            const query = new URLSearchParams({name: lock.name, id: lock.id});
            const response = await fetch(`${URL_LOCKS}?${query}`, {method: "DELETE", headers: headers()});
            if (response.ok) trackDone(info);
            else trackRefused({...info, reason: refusalReason({status: response.status, detail: await getResponseErrorMessage(response)})});
        } catch (err) {
            trackRefused({...info, reason: err.message});
        } finally {
            setBusy(false);
            reload();
        }
    };

    const when = (value) => <RelativeTime value={value} locale={i18n.language}/>;
    // A lease run out is no lock: gone at the next read, hidden until then.
    const held = (locks ?? []).filter((lock) => !(lock.endsAt <= now));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-3">
                <p className="min-w-0 flex-1 text-ink-muted">{t("clusterLocks.intro")}</p>
                <Button size="sm" variant="ghost" icon={<RefreshIcon className="h-3.5 w-3.5"/>} onClick={reload}>
                    {t("clusterLocks.refresh")}
                </Button>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            {locks === null ? (
                !error && <div className="flex justify-center py-4"><Spinner label={t("clusterLocks.loading")}/></div>
            ) : (
                <Table aria-label={t("clusterLocks.table")}>
                    <thead>
                        <HeaderRow>
                            <HeaderCell>{t("common.name")}</HeaderCell>
                            <HeaderCell>{t("clusterLocks.holder")}</HeaderCell>
                            <HeaderCell>{t("common.node")}</HeaderCell>
                            <HeaderCell>{t("clusterLocks.acquired")}</HeaderCell>
                            <HeaderCell>{t("clusterLocks.lease")}</HeaderCell>
                            <HeaderCell>{t("clusterLocks.id")}</HeaderCell>
                            <HeaderCell><span className="sr-only">{t("clusterLocks.actions")}</span></HeaderCell>
                        </HeaderRow>
                    </thead>
                    <tbody>
                        {held.map((lock) => (
                            <Row key={`${lock.name} ${lock.id}`}>
                                <Cell className="whitespace-nowrap font-mono font-medium">{lock.name}</Cell>
                                <Cell>{lock.holder || "–"}</Cell>
                                <Cell>{lock.node ? <CrossLink kind="node" id={lock.node}>{lock.node}</CrossLink> : "–"}</Cell>
                                <Cell className="whitespace-nowrap">{when(lock.acquired_at)}</Cell>
                                <Cell className="whitespace-nowrap tabular-nums">{Number.isNaN(lock.endsAt) ? "–" : left(lock.endsAt - now, t)}</Cell>
                                <Cell className="font-mono text-data text-ink-muted">{lock.id}</Cell>
                                <Cell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={busy}
                                        aria-label={t("clusterLocks.releaseOne", {name: lock.name})}
                                        onClick={() => setReleasing(lock)}
                                    >
                                        {t("clusterLocks.release")}
                                    </Button>
                                </Cell>
                            </Row>
                        ))}
                        {held.length === 0 && <EmptyRow colSpan={7}>{t("clusterLocks.none")}</EmptyRow>}
                    </tbody>
                </Table>
            )}
            <p className="text-ink-muted">{t("clusterLocks.footer", {seconds: LOCKS_EVERY_MS / 1000})}</p>

            <Dialog
                open={releasing !== null}
                onClose={() => setReleasing(null)}
                title={releasing ? t("clusterLocks.confirmTitle", {name: releasing.name}) : ""}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setReleasing(null)}>{t("common.cancel")}</Button>
                        <Button variant="primary" onClick={release}>{t("clusterLocks.release")}</Button>
                    </>
                }
            >
                {releasing && (
                    <div className="space-y-2 text-ink">
                        <p>{t("clusterLocks.confirm", {name: releasing.name, holder: releasing.holder || releasing.node || "?"})}</p>
                        <Alert tone="warning">{t("clusterLocks.warning")}</Alert>
                        <p className="text-ink-muted">{t("clusterLocks.byId", {id: releasing.id})}</p>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
