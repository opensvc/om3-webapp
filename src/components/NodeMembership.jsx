import React, {useEffect, useId, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER, URL_CLUSTER_STATUS, URL_NODE} from "../config/apiPath.js";
import useEventStore from "../hooks/useEventStore.js";
import {rereadClusterStatus} from "../hooks/clusterStatusOnce";
import {getResponseErrorMessage} from "../services/api.jsx";
import {trackPoll, trackRefused, trackResponse} from "../app/action-tracker";
import {refusalReason} from "./objectActions";
import {Subject} from "./ActionDialogs";
import {Dialog} from "../ui/components/Dialog";
import {Button} from "../ui/components/Button";
import {Checkbox, Field, Input, Textarea} from "../ui/components/Field";
import {Alert} from "../ui/components/Alert";
import {Spinner} from "../ui/components/Spinner";

/*
 * The membership of the cluster, as om drives it: a node enrolled (`om cluster
 * enroll`), a node evicted (`om cluster evict`), nodes registered on the collector
 * (`om node register`, on each, as `om cluster register` does). Root asks them.
 *
 * Enrolled and evicted, the daemon answers once the node accepted the order: what
 * comes of it, the actions tray says, reading the cluster configuration again until
 * the node is in, beating, or out of it. Registered, each node runs `om node
 * register`, an exec of its own, followed to its end.
 */

const ZERO_DATE = "0001-01-01T00:00:00Z";

/** How long a node enrolled is waited for: its drain may stop all it runs. */
export const ENROLL_TIMEOUT_MS = 30 * 60_000;
/** How long a node evicted is waited for, out of the cluster nodes. */
export const EVICT_TIMEOUT_MS = 5 * 60_000;
/** How often the cluster configuration is read again meanwhile. */
const MEMBERSHIP_EVERY_MS = 3000;

const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
    "Content-Type": "application/json",
});

/** Availabilities that tell an instance runs, as the daemon tells a node not drained. */
const RUNNING = ["up", "warn"];

/**
 * Why `node` is not drained, as the daemon of the node to evict tells it: null when
 * it is, frozen and running no svc, no drain in progress nor failed. `store` holds
 * the node status, monitor and the instances, as the event store does.
 */
export function notDrainedReason(node, {nodeStatus, nodeMonitor, objectInstanceStatus} = {}) {
    const status = nodeStatus?.[node];
    if (!status) return {key: "unknown"};
    if (!status.frozen_at || status.frozen_at === ZERO_DATE) return {key: "notFrozen"};
    const monitor = nodeMonitor?.[node];
    if (monitor?.local_expect === "drained" || monitor?.state === "draining") return {key: "draining"};
    if (monitor?.state === "drain failed") return {key: "drainFailed"};
    const up = Object.entries(objectInstanceStatus ?? {})
        .filter(([path, instances]) => path.split("/")[1] === "svc" && RUNNING.includes(instances?.[node]?.avail))
        .map(([path]) => path)
        .sort();
    if (up.length > 0) return {key: "running", paths: up};
    return null;
}

/** The cluster status as it is now, not the one read once a session. */
async function readStatus() {
    const response = await fetch(URL_CLUSTER_STATUS, {headers: authHeaders(), cache: "no-cache"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

/** Whether a user and a password are both given or both left out; the error to say otherwise. */
const credentialError = (t, user, password) => {
    if (user !== "" && password === "") return t("membership.errors.passwordMissing");
    if (user === "" && password !== "") return t("membership.errors.userMissing");
    return null;
};

/** The refusal of `response` in words, for the dialog and the actions tray. */
const refusalOf = async (response) => refusalReason({status: response.status, detail: await getResponseErrorMessage(response)});

/** A user and a password, both or neither: the credential of a user to create, or of the collector. */
function CredentialFields({user, password, setUser, setPassword, error, userLabel, passwordLabel, hint}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <Field label={userLabel} hint={hint}>
                {(control) => (
                    <Input {...control} value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" spellCheck={false}/>
                )}
            </Field>
            <Field label={passwordLabel} error={error}>
                {(control) => (
                    <Input {...control} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password"/>
                )}
            </Field>
        </div>
    );
}

/** The footer of a dialog asking: Cancel, and its submit button, busy while it asks. */
function Footer({formId, submitting, disabled, submitLabel, busyLabel, onClose}) {
    const {t} = useTranslation();
    return (
        <>
            <Button onClick={onClose} disabled={submitting}>{t("common.cancel")}</Button>
            <Button
                variant="primary"
                type="submit"
                form={formId}
                disabled={submitting || disabled}
                icon={submitting ? <Spinner label={busyLabel}/> : undefined}
            >
                {submitLabel}
            </Button>
        </>
    );
}

/**
 * A node enrolled into this cluster (`om cluster enroll`): its address, and a token
 * with the join role created on it. Drained first, its instances stopped and gone
 * from its configuration: acknowledged before. Refused, the dialog stays and says why.
 */
export function EnrollDialog({open, onClose}) {
    const {t} = useTranslation();
    const formId = useId();
    const addressRef = useRef(null);
    const [address, setAddress] = useState("");
    const [token, setToken] = useState("");
    const [joinAddr, setJoinAddr] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [touched, setTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setAddress("");
        setToken("");
        setJoinAddr("");
        setAcknowledged(false);
        setTouched(false);
        setError(null);
    }, [open]);

    const addressError = address.trim() === "" ? t("membership.errors.addressMissing") : null;
    const tokenError = token.trim() === "" ? t("membership.errors.tokenMissing") : null;

    const submit = async (event) => {
        event?.preventDefault();
        setTouched(true);
        if (addressError || tokenError || !acknowledged || submitting) return;
        setSubmitting(true);
        setError(null);
        const node = address.trim();
        const info = {action: "enroll", label: t("membership.enroll.label"), subject: node};
        try {
            const response = await fetch(`${URL_CLUSTER}/enroll`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    node,
                    token: token.trim(),
                    ...(joinAddr.trim() === "" ? {} : {join_addr: joinAddr.trim()}),
                }),
            });
            if (!response.ok) {
                const reason = await refusalOf(response);
                trackRefused({...info, reason});
                setError(reason);
                return;
            }
            // The nodename the node reads in its own configuration, for the address may be another name.
            const nodename = (await response.json().catch(() => null))?.node || node;
            trackPoll({...info, subject: nodename}, async () => {
                const status = await readStatus();
                const joined = (status?.cluster?.config?.nodes ?? []).includes(nodename)
                    && !!status?.cluster?.node?.[nodename]?.monitor?.state;
                if (joined) rereadClusterStatus();
                return joined;
            }, {
                lost: t("actionTray.noNews", {seconds: ENROLL_TIMEOUT_MS / 1000}),
                timeoutMs: ENROLL_TIMEOUT_MS,
                everyMs: MEMBERSHIP_EVERY_MS,
            });
            onClose();
        } catch (err) {
            trackRefused({...info, reason: err.message});
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={submitting ? () => {} : onClose}
            title={t("membership.enroll.title")}
            size="md"
            initialFocus={addressRef}
            footer={
                <Footer
                    formId={formId}
                    submitting={submitting}
                    disabled={!acknowledged}
                    submitLabel={t("membership.enroll.submit")}
                    busyLabel={t("membership.enroll.busy")}
                    onClose={onClose}
                />
            }
        >
            <form id={formId} onSubmit={submit} noValidate className="space-y-3">
                <p className="text-ink">{t("membership.enroll.intro")}</p>
                <Field label={t("membership.enroll.address")} hint={t("membership.enroll.addressHint")} error={touched ? addressError : null}>
                    {(control) => (
                        <Input
                            {...control}
                            ref={addressRef}
                            value={address}
                            placeholder="node3.example.com:1215"
                            onChange={(e) => setAddress(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    )}
                </Field>
                <Field
                    label={t("membership.enroll.token")}
                    hint={<>{t("membership.enroll.tokenHint")} <code className="font-mono">om daemon auth --role join</code></>}
                    error={touched ? tokenError : null}
                >
                    {(control) => (
                        <Textarea
                            {...control}
                            value={token}
                            rows={3}
                            onChange={(e) => setToken(e.target.value)}
                            spellCheck={false}
                            className="font-mono text-data break-all"
                        />
                    )}
                </Field>
                <Field label={t("membership.enroll.joinAddr")} hint={t("membership.enroll.joinAddrHint")}>
                    {(control) => (
                        <Input {...control} value={joinAddr} onChange={(e) => setJoinAddr(e.target.value)} autoComplete="off" spellCheck={false}/>
                    )}
                </Field>
                <Alert tone="warning">{t("membership.enroll.warning")}</Alert>
                <Checkbox
                    label={t("membership.enroll.acknowledge")}
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                />
                {error !== null && <Alert tone="error">{error}</Alert>}
            </form>
        </Dialog>
    );
}

/**
 * A node evicted from the cluster (`om cluster evict`): drained, it leaves, restarts
 * alone in a cluster of its own, with a user created there if asked. Not drained, or
 * the node serving this page, it is said why and nothing is asked.
 */
export function EvictDialog({node, open, onClose}) {
    const {t} = useTranslation();
    const formId = useId();
    const [user, setUser] = useState("");
    const [password, setPassword] = useState("");
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    // The node serving the API, which can not evict itself: read when the dialog opens.
    const [apiNode, setApiNode] = useState(null);
    const nodeStatus = useEventStore((state) => state.nodeStatus);
    const nodeMonitor = useEventStore((state) => state.nodeMonitor);
    const objectInstanceStatus = useEventStore((state) => state.objectInstanceStatus);
    const notDrained = useMemo(
        () => notDrainedReason(node, {nodeStatus, nodeMonitor, objectInstanceStatus}),
        [node, nodeStatus, nodeMonitor, objectInstanceStatus]
    );

    useEffect(() => {
        if (!open) return undefined;
        setUser("");
        setPassword("");
        setAcknowledged(false);
        setError(null);
        let live = true;
        readStatus().then((status) => {
            if (live) setApiNode(status?.daemon?.nodename ?? null);
        }).catch(() => {});
        return () => {
            live = false;
        };
    }, [open, node]);

    const isApiNode = apiNode !== null && apiNode === node;
    const credError = credentialError(t, user, password);
    const blocked = isApiNode || notDrained !== null;

    const submit = async (event) => {
        event?.preventDefault();
        if (blocked || credError || !acknowledged || submitting) return;
        setSubmitting(true);
        setError(null);
        const info = {action: "evict", label: t("membership.evict.label"), subject: node};
        try {
            const response = await fetch(`${URL_CLUSTER}/evict`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({nodename: node, ...(user === "" ? {} : {credential: `${user}:${password}`})}),
            });
            if (!response.ok) {
                const reason = await refusalOf(response);
                trackRefused({...info, reason});
                setError(reason);
                return;
            }
            trackPoll(info, async () => {
                const status = await readStatus();
                const nodes = status?.cluster?.config?.nodes;
                const left = Array.isArray(nodes) && !nodes.includes(node);
                if (left) rereadClusterStatus();
                return left;
            }, {
                lost: t("actionTray.noNews", {seconds: EVICT_TIMEOUT_MS / 1000}),
                timeoutMs: EVICT_TIMEOUT_MS,
                everyMs: MEMBERSHIP_EVERY_MS,
            });
            onClose();
        } catch (err) {
            trackRefused({...info, reason: err.message});
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const reason = notDrained === null ? null : t(`membership.evict.notDrained.${notDrained.key}`, {
        node,
        paths: (notDrained.paths ?? []).join(", "),
    });

    return (
        <Dialog
            open={open}
            onClose={submitting ? () => {} : onClose}
            title={t("membership.evict.title", {node})}
            size="md"
            footer={
                <Footer
                    formId={formId}
                    submitting={submitting}
                    disabled={blocked || !acknowledged}
                    submitLabel={t("membership.evict.submit")}
                    busyLabel={t("membership.evict.busy")}
                    onClose={onClose}
                />
            }
        >
            <form id={formId} onSubmit={submit} noValidate className="space-y-3">
                <p className="text-ink">{t("membership.evict.intro", {node})}</p>
                {isApiNode && <Alert tone="warning">{t("membership.evict.apiNode", {node})}</Alert>}
                {!isApiNode && reason !== null && (
                    <Alert tone="warning">{t("membership.evict.drainFirst", {reason})}</Alert>
                )}
                <CredentialFields
                    user={user}
                    password={password}
                    setUser={setUser}
                    setPassword={setPassword}
                    error={credError}
                    userLabel={t("membership.evict.user")}
                    passwordLabel={t("membership.evict.password")}
                    hint={t("membership.evict.credentialHint", {node})}
                />
                <Checkbox
                    label={t("membership.evict.acknowledge", {node})}
                    checked={acknowledged}
                    disabled={blocked}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                />
                {error !== null && <Alert tone="error">{error}</Alert>}
            </form>
        </Dialog>
    );
}

/**
 * Nodes registered on the collector (`om node register` on each, as `om cluster
 * register` asks them): with the credentials of a collector user, or again with the
 * id each holds. Each run followed in the actions tray; all refused, the dialog
 * stays and says why.
 */
export function RegisterDialog({nodes, open, onClose}) {
    const {t} = useTranslation();
    const formId = useId();
    const [user, setUser] = useState("");
    const [password, setPassword] = useState("");
    const [app, setApp] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        setUser("");
        setPassword("");
        setApp("");
        setError(null);
    }, [open]);

    const credError = credentialError(t, user, password);
    const names = nodes ?? [];

    const submit = async (event) => {
        event?.preventDefault();
        if (credError || submitting || names.length === 0) return;
        setSubmitting(true);
        setError(null);
        const body = JSON.stringify({
            ...(user === "" ? {} : {user, password}),
            ...(app.trim() === "" ? {} : {app: app.trim()}),
        });
        const refusals = await Promise.all(names.map(async (node) => {
            const info = {action: "register", subject: node, node};
            try {
                const response = await fetch(`${URL_NODE}/${encodeURIComponent(node)}/action/register`, {
                    method: "POST",
                    headers: authHeaders(),
                    body,
                });
                if (!response.ok) {
                    const reason = await refusalOf(response);
                    trackRefused({...info, reason});
                    return reason;
                }
                await trackResponse(response, info);
                return null;
            } catch (err) {
                trackRefused({...info, reason: err.message});
                return err.message;
            }
        }));
        setSubmitting(false);
        if (refusals.every((r) => r !== null)) {
            setError(refusals[0]);
            return;
        }
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={submitting ? () => {} : onClose}
            title={t("membership.register.title")}
            size="md"
            footer={
                <Footer
                    formId={formId}
                    submitting={submitting}
                    disabled={names.length === 0}
                    submitLabel={t("membership.register.submit")}
                    busyLabel={t("membership.register.busy")}
                    onClose={onClose}
                />
            }
        >
            <form id={formId} onSubmit={submit} noValidate className="space-y-3">
                <p className="text-ink">{t("membership.register.intro")}</p>
                <Subject
                    target={names.length === 1 ? t("nodes.target.node", {node: names[0]}) : t("nodes.target.selected", {count: names.length})}
                    names={names}
                />
                <CredentialFields
                    user={user}
                    password={password}
                    setUser={setUser}
                    setPassword={setPassword}
                    error={credError}
                    userLabel={t("membership.register.user")}
                    passwordLabel={t("membership.register.password")}
                    hint={t("membership.register.credentialHint")}
                />
                <Field label={t("membership.register.app")} hint={t("membership.register.appHint")}>
                    {(control) => (
                        <Input {...control} value={app} onChange={(e) => setApp(e.target.value)} autoComplete="off" spellCheck={false}/>
                    )}
                </Field>
                {error !== null && <Alert tone="error">{error}</Alert>}
            </form>
        </Dialog>
    );
}
