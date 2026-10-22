import React, {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER} from "../config/apiPath.js";
import {apiFetch, authHeaders, problemOf} from "../services/api.jsx";
import {trackDone, trackPoll, trackRefused} from "../app/action-tracker";
import {refusalReason} from "./objectActions";
import {pageSeen, usePagePoll} from "../hooks/usePagePoll";
import {CrossLink} from "../app/CrossLink";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {Field, Input} from "../ui/components/Field";
import {useAuthUser} from "../context/AuthProvider.jsx";
import {Spinner} from "../ui/components/Spinner";
import {RelativeTime} from "../ui/components/RelativeTime";
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {PlusIcon, RefreshIcon} from "../ui/icons";

/*
 * The cluster locks, as `om cluster lock list` shows them: the ones the node
 * speaking for the cluster granted, whose holder has neither released them nor
 * seen their lease end; each released on demand, as `om cluster lock release`
 * does; acquired on demand, as a client of the daemon takes one. Root reads,
 * acquires and releases them. No event tells a lock taken or released:
 * read again a few seconds after each read ends, while shown and the page seen
 * (usePagePoll).
 */

/** How long after a read ends the locks are read again, while shown. */
export const LOCKS_EVERY_MS = 5000;

const URL_LOCKS = `${URL_CLUSTER}/lock`;

/** How long a release is waited for: the node speaking for the cluster may be slow to answer. */
export const RELEASE_TIMEOUT_MS = 60_000;

/** The longest lease the daemon grants: a lock held longer would outlive its holder. */
export const MAX_LEASE_MS = 10 * 60_000;

/** How long an acquisition is waited for beyond the wait asked: the node speaking may be slow to answer. */
const ACQUIRE_SLACK_MS = 30_000;

/** The reason of a refusal apiFetch threw: the daemon's words, by its status. */
const refusalOf = (err) => refusalReason({status: err.status, detail: problemOf(err)});

/** A refusal saying the session may not read them: the locks are not shown, no matter what was read before. */
const denied = (err) => err.status === 401 || err.status === 403;

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
    // The last read failing: the locks read before kept, said not current, none released.
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => Date.now());
    // The lock to release, waiting for its confirmation.
    const [releasing, setReleasing] = useState(null);
    // The lock to acquire, its form open; null closed.
    const [acquiring, setAcquiring] = useState(null);
    const [reads, setReads] = useState(0);
    const reload = useCallback(() => setReads((n) => n + 1), []);

    usePagePoll(async (live) => {
        try {
            const body = await apiFetch(URL_LOCKS, {headers: authHeaders(), cache: "no-cache"});
            if (!live()) return;
            const readAt = Date.now();
            setLocks((body?.items ?? []).map((lock) => {
                const lease = durationMs(lock.expires_in);
                // Rebased on this clock from the lease left, as the nodes do: the clocks
                // need not agree. Without it, the end the daemon wrote, on its clock:
                // counted down, never hidden here, the next read dropping it once ended.
                return {
                    ...lock,
                    name: String(lock.name ?? ""),
                    endsAt: lease !== null ? readAt + lease : Date.parse(lock.expires_at),
                    ownClock: lease !== null,
                };
            }).sort((a, b) => a.name.localeCompare(b.name)));
            // Counted down from the moment read, not from the last tick before it.
            setNow(readAt);
            setError("");
        } catch (err) {
            if (!live()) return;
            if (denied(err)) {
                setLocks(null);
                setError(t("clusterLocks.forbidden"));
            } else {
                // A read failing once (a timeout, a node restarting): the locks read kept, said not current.
                setError(refusalOf(err));
            }
        }
    }, LOCKS_EVERY_MS, [reads, t]);

    // The leases counted down between two reads, while the page is seen.
    useEffect(() => {
        const timer = setInterval(() => {
            if (pageSeen()) setNow(Date.now());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const when = (value) => <RelativeTime value={value} locale={i18n.language}/>;
    // A lease run out on this clock is no lock: gone at the next read, hidden until then.
    const held = (locks ?? []).filter((lock) => !lock.ownClock || Number.isNaN(lock.endsAt) || lock.endsAt > now);
    const stale = locks !== null && error !== "";
    // Confirmed only while the lock is held: released or its lease run out meanwhile, nothing to confirm.
    const releasingHeld = releasing !== null && held.some((lock) => lock.name === releasing.name && lock.id === releasing.id);

    const release = async () => {
        const lock = releasing;
        // The confirmation closes on the first click: a second one finds nothing to release.
        if (!releasingHeld) return;
        setReleasing(null);
        const info = {action: "release", label: t("clusterLocks.release"), subject: t("clusterLocks.subject", {name: lock.name})};
        try {
            const query = new URLSearchParams({name: lock.name, id: lock.id});
            await apiFetch(`${URL_LOCKS}?${query}`, {method: "DELETE", headers: authHeaders(), timeout: RELEASE_TIMEOUT_MS});
            trackDone(info);
        } catch (err) {
            if (err.status) {
                trackRefused({...info, reason: refusalOf(err)});
            } else {
                // No answer, the request timed out or cut: released or not, the locks tell it.
                trackPoll(info, async () => {
                    const body = await apiFetch(URL_LOCKS, {headers: authHeaders(), cache: "no-cache"});
                    return !(body?.items ?? []).some((l) => l.name === lock.name && l.id === lock.id);
                }, {lost: t("clusterLocks.unanswered", {message: err.message})});
            }
        } finally {
            reload();
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-start gap-3">
                <p className="min-w-0 flex-1 text-ink-muted">{t("clusterLocks.intro")}</p>
                <Button size="sm" icon={<RefreshIcon className="h-3.5 w-3.5"/>} onClick={reload}>
                    {t("clusterLocks.refresh")}
                </Button>
                {/* Root alone acquires one, as it reads them: not offered to whom may not read them. */}
                {locks !== null && (
                    <Button size="sm" variant="create" icon={<PlusIcon className="h-3.5 w-3.5"/>} onClick={() => setAcquiring({})}>
                        {t("clusterLocks.acquire.open")}
                    </Button>
                )}
            </div>
            {error && (
                <Alert tone={stale ? "warning" : "error"}>
                    {stale ? t("clusterLocks.stale", {message: error}) : error}
                </Alert>
            )}
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
                                        // Not current, a lock may be gone: none released until read again.
                                        disabled={stale}
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
                open={releasingHeld}
                onClose={() => setReleasing(null)}
                title={releasing ? t("clusterLocks.confirmTitle", {name: releasing.name}) : ""}
                footer={
                    <>
                        <Button onClick={() => setReleasing(null)}>{t("common.cancel")}</Button>
                        {/* The lock taken away from its holder: red, as what is removed. */}
                        <Button variant="delete" onClick={release}>{t("clusterLocks.release")}</Button>
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

            <AcquireDialog open={acquiring !== null} onClose={() => setAcquiring(null)} onAcquired={reload}/>
        </div>
    );
}

/** A lease or a wait as typed: "" for none, else a Go duration, null when it reads as none. */
const typedMs = (text) => (text.trim() === "" ? 0 : durationMs(text.trim()));

/**
 * Acquires a cluster lock, as a client of the daemon takes one (POST /cluster/lock):
 * its name, who holds it (the user signed in, from the webapp, unless said), its
 * lease (30 s unless said, 10 min at most) and how long to wait for it while
 * another holds it (not at all unless said). Held by another, it says so and stays
 * open; granted, the actions tray says it and the locks are read again.
 */
function AcquireDialog({open, onClose, onAcquired}) {
    const {t} = useTranslation();
    const user = useAuthUser();
    const defaultHolder = user ? t("clusterLocks.acquire.holderOf", {user}) : t("clusterLocks.acquire.holderWebapp");
    const [name, setName] = useState("");
    const [holder, setHolder] = useState(defaultHolder);
    const [lease, setLease] = useState("30s");
    const [wait, setWait] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [tried, setTried] = useState(false);

    // Each opening starts over.
    useEffect(() => {
        if (!open) return;
        setName("");
        setHolder(defaultHolder);
        setLease("30s");
        setWait("");
        setError("");
        setTried(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const leaseMs = typedMs(lease);
    const waitMs = typedMs(wait);
    const nameError = name.trim() === "" ? t("clusterLocks.acquire.nameRequired") : null;
    const leaseError = leaseMs === null || leaseMs < 0
        ? t("clusterLocks.acquire.badDuration")
        : leaseMs > MAX_LEASE_MS ? t("clusterLocks.acquire.leaseTooLong") : null;
    const waitError = waitMs === null || waitMs < 0 ? t("clusterLocks.acquire.badDuration") : null;
    const invalid = nameError !== null || leaseError !== null || waitError !== null;

    const submit = async (event) => {
        event?.preventDefault();
        setTried(true);
        if (invalid || submitting) return;
        setSubmitting(true);
        setError("");
        const lockName = name.trim();
        const info = {action: "acquire", label: t("clusterLocks.acquire.label"), subject: t("clusterLocks.subject", {name: lockName})};
        const body = {name: lockName};
        if (holder.trim() !== "") body.holder = holder.trim();
        if (lease.trim() !== "") body.lease = lease.trim();
        if (wait.trim() !== "") body.wait = wait.trim();
        try {
            await apiFetch(URL_LOCKS, {
                method: "POST",
                headers: {...authHeaders(), "Content-Type": "application/json"},
                body: JSON.stringify(body),
                // The daemon answers once granted, or once the wait asked is over.
                timeout: waitMs + ACQUIRE_SLACK_MS,
            });
            trackDone(info);
            onClose();
        } catch (err) {
            const reason = err.status ? refusalOf(err) : err.message;
            trackRefused({...info, reason});
            // Held by another: said here, the form kept to try again or wait longer.
            setError(err.status === 409 ? t("clusterLocks.acquire.held", {message: problemOf(err) || reason}) : reason);
        } finally {
            setSubmitting(false);
            onAcquired();
        }
    };

    const formId = "cluster-lock-acquire";
    return (
        <Dialog
            open={open}
            onClose={submitting ? () => {} : onClose}
            title={t("clusterLocks.acquire.title")}
            footer={
                <>
                    <Button onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
                    <Button
                        variant="create"
                        type="submit"
                        form={formId}
                        disabled={submitting}
                        icon={submitting ? <Spinner label={t("clusterLocks.acquire.acquiring")}/> : undefined}
                    >
                        {t("clusterLocks.acquire.submit")}
                    </Button>
                </>
            }
        >
            <form id={formId} onSubmit={submit} noValidate className="space-y-3">
                <p className="text-ink-muted">{t("clusterLocks.acquire.intro")}</p>
                <Field label={t("common.name")} error={tried ? nameError : null}>
                    {(control) => (
                        <Input {...control} value={name} onChange={(e) => setName(e.target.value)}
                               autoComplete="off" spellCheck={false} autoFocus/>
                    )}
                </Field>
                <Field label={t("clusterLocks.holder")} hint={t("clusterLocks.acquire.holderHint")}>
                    {(control) => (
                        <Input {...control} value={holder} onChange={(e) => setHolder(e.target.value)}
                               autoComplete="off" spellCheck={false}/>
                    )}
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("clusterLocks.acquire.lease")} hint={t("clusterLocks.acquire.leaseHint")}
                           error={leaseError}>
                        {(control) => (
                            <Input {...control} value={lease} onChange={(e) => setLease(e.target.value)}
                                   placeholder="30s" autoComplete="off" spellCheck={false}/>
                        )}
                    </Field>
                    <Field label={t("clusterLocks.acquire.wait")} hint={t("clusterLocks.acquire.waitHint")}
                           error={waitError}>
                        {(control) => (
                            <Input {...control} value={wait} onChange={(e) => setWait(e.target.value)}
                                   placeholder="10s" autoComplete="off" spellCheck={false}/>
                        )}
                    </Field>
                </div>
                <Alert tone="warning">{t("clusterLocks.acquire.warning")}</Alert>
                {error && <Alert tone="error">{error}</Alert>}
            </form>
        </Dialog>
    );
}
