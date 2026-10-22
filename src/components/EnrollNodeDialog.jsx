import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {CopyButton} from "../ui/components/CopyButton";
import {Checkbox, Field, Input, Textarea} from "../ui/components/Field";
import {Dialog} from "../ui/components/Dialog";
import {Spinner} from "../ui/components/Spinner";
import {URL_CLUSTER} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {trackRefused, trackUntil} from "../app/action-tracker";
import {refusalReason} from "./objectActions";

/** The command creating, on the node to enroll, the token this dialog asks for. */
export const JOIN_TOKEN_COMMAND = "om daemon auth --role join";

/**
 * The token page of the node at `address` ([scheme://]addr[:port]), asking a join
 * token: https and the daemon listener port by default, the webapp under /ui.
 */
export function tokenPageUrl(address) {
    const text = address.trim();
    if (text.length < 2) return null;
    const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/:]+|\[[^\]]+\])(?::(\d+))?\/?$/i.exec(text);
    if (match === null) return null;
    const [, scheme = "https", host, port = "1215"] = match;
    return `${scheme}://${host}:${port}/ui/token?role=join`;
}

/** How long the node is followed until it is seen in the cluster: its drain included. */
export const ENROLL_FOLLOW_MS = 15 * 60 * 1000;

/** Ignored by the password managers: none of these fields is a login. */
const NOT_A_LOGIN = {
    autoComplete: "off",
    spellCheck: false,
    "data-protonpass-ignore": "true",
    "data-1p-ignore": "true",
    "data-lpignore": "true",
    "data-bwignore": "true",
    "data-form-type": "other",
};

/**
 * Enrolls a foreign node into the cluster, as `om cluster enroll` does: its address
 * and a token with the join role, created on it (`JOIN_TOKEN_COMMAND`); the address
 * it reaches this cluster at and the lifetime of its token, folded away. The node is
 * drained before it leaves its cluster, its instances stopped and dropped: said, and
 * understood before it goes. Accepted, the actions tray follows the node until the
 * cluster lists it; refused, the dialog says why.
 */
export function EnrollNodeDialog({open, onClose}) {
    const {t} = useTranslation();
    const [node, setNode] = useState("");
    const [token, setToken] = useState("");
    const [joinAddr, setJoinAddr] = useState("");
    const [timeout, setTimeoutValue] = useState("");
    const [understood, setUnderstood] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    // Each opening starts over.
    useEffect(() => {
        if (!open) return;
        setNode("");
        setToken("");
        setJoinAddr("");
        setTimeoutValue("");
        setUnderstood(false);
        setError(null);
    }, [open]);

    const ready = node.trim().length >= 2 && token.trim() !== "" && understood && !sending;

    const submit = async (event) => {
        event?.preventDefault();
        if (!ready) return;
        const address = node.trim();
        const info = {action: "enroll", subject: address, label: t("enroll.tray", {node: address})};
        setSending(true);
        setError(null);
        try {
            const body = {node: address, token: token.trim()};
            if (joinAddr.trim()) body.join_addr = joinAddr.trim();
            if (timeout.trim()) body.timeout = timeout.trim();
            const response = await fetch(`${URL_CLUSTER}/enroll`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("authToken") ?? ""}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                const detail = await getResponseErrorMessage(response);
                trackRefused({...info, reason: refusalReason({status: response.status, detail})});
                setError(detail || `HTTP ${response.status}`);
                return;
            }
            // The answer names the node as it calls itself: the cluster lists it so.
            const accepted = await response.json().catch(() => ({}));
            const name = accepted.node || address;
            trackUntil(
                {...info, subject: name, label: t("enroll.tray", {node: name})},
                (store) => Boolean(store?.nodeStatus?.[name]),
                {lost: t("enroll.lost", {node: name}), timeoutMs: ENROLL_FOLLOW_MS},
            );
            onClose();
        } catch (err) {
            trackRefused({...info, reason: err.message});
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={sending ? () => {} : onClose}
            title={t("enroll.title")}
            size="lg"
            footer={(
                <>
                    <Button onMouseDown={(e) => e.preventDefault()} onClick={onClose} disabled={sending}>{t("common.cancel")}</Button>
                    <Button
                        variant="create"
                        type="submit"
                        form="enroll-node-form"
                        disabled={!ready}
                        icon={sending ? <Spinner label={t("enroll.submitting")}/> : undefined}
                    >
                        {sending ? t("enroll.submitting") : t("enroll.submit")}
                    </Button>
                </>
            )}
        >
            <form id="enroll-node-form" onSubmit={submit} noValidate className="space-y-3">
                <p>{t("enroll.intro")}</p>
                <div className="space-y-1">
                    <p className="text-ink-muted">
                        {tokenPageUrl(node) ? (
                            <a href={tokenPageUrl(node)} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                                {t("enroll.tokenPage", {node: node.trim()})}
                            </a>
                        ) : t("enroll.tokenPageFirst")}
                        {" "}{t("enroll.tokenPageWhy")}
                    </p>
                    <p className="text-ink-muted">{t("enroll.tokenHow")}</p>
                    <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded-(--radius-control) bg-surface-sunken px-2 py-1 font-mono text-data">
                            {JOIN_TOKEN_COMMAND}
                        </code>
                        <CopyButton text={JOIN_TOKEN_COMMAND} label={t("enroll.copyCommand")}/>
                    </div>
                </div>
                <Field label={t("enroll.node")} hint={t("enroll.nodeHint")}>
                    {(control) => (
                        <Input
                            {...control}
                            {...NOT_A_LOGIN}
                            name="enroll-node"
                            value={node}
                            onChange={(e) => setNode(e.target.value)}
                            placeholder="node3.example.com:1215"
                        />
                    )}
                </Field>
                <Field label={t("enroll.token")} hint={t("enroll.tokenHint")}>
                    {(control) => (
                        <Textarea
                            {...control}
                            {...NOT_A_LOGIN}
                            name="enroll-token"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            rows={3}
                            className="font-mono text-data break-all"
                        />
                    )}
                </Field>
                <details className="space-y-3">
                    <summary className="cursor-pointer text-ink-muted">{t("enroll.more")}</summary>
                    <div className="mt-3 space-y-3">
                        <Field label={t("enroll.joinAddr")} hint={t("enroll.joinAddrHint")}>
                            {(control) => (
                                <Input
                                    {...control}
                                    {...NOT_A_LOGIN}
                                    name="enroll-join-addr"
                                    value={joinAddr}
                                    onChange={(e) => setJoinAddr(e.target.value)}
                                    placeholder="node1.example.com:1215"
                                />
                            )}
                        </Field>
                        <Field label={t("enroll.timeout")} hint={t("enroll.timeoutHint")}>
                            {(control) => (
                                <Input
                                    {...control}
                                    {...NOT_A_LOGIN}
                                    name="enroll-timeout"
                                    value={timeout}
                                    onChange={(e) => setTimeoutValue(e.target.value)}
                                    placeholder="1h"
                                    className="w-32"
                                />
                            )}
                        </Field>
                    </div>
                </details>
                <Alert tone="warning">{t("enroll.warning")}</Alert>
                <Checkbox
                    label={t("nodeActions.understood")}
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                />
                {error && <Alert>{t("enroll.failed", {message: error})}</Alert>}
            </form>
        </Dialog>
    );
}
