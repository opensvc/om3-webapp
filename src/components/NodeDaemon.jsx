import React, {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER_STATUS} from "../config/apiPath.js";
import useEventStore from "../hooks/useEventStore.js";
import {retainEventReception} from "../eventSourceManager";
import {getResponseErrorMessage} from "../services/api.jsx";
import {Alert} from "../ui/components/Alert";
import {Button, IconButton} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {MenuButton} from "../ui/components/MenuButton";
import {RelativeTime} from "../ui/components/RelativeTime";
import {StatusMark} from "../ui/components/StatusMark";
import {CloseIcon, GearIcon, RefreshIcon} from "../ui/icons";
import {
    DataTable,
    FilterField,
    Loaded,
    Section,
    authHeaders,
    isSet,
    itemsOf,
    matches,
    nodeUrl,
    useApiResource,
} from "./NodePanel";

/*
 * The daemon of a node, as `om daemon` shows and drives it: its components and
 * their state, its listener, its heartbeats, the orchestrations it
 * runs and the commands it executes, and the DNS zone it serves. Read from the API
 * of om3 main (daemon/*), each action confirmed first.
 */

/** The components of the daemon the node status reports, in the order of `om daemon status`. */
const COMPONENTS = ["listener", "dns", "scheduler", "runner_imon", "collector", "daemondata"];

/** The listener the API answers start, stop and restart for: api.ux lives as long as the daemon. */
const LISTENER = "api.inet";

/** A component or a stream state as a mark: running is up, stopped or failed down. */
const markOf = (state) =>
    ["running", "speaker"].includes(state) ? "up" : ["stopped", "failed", "error"].includes(state) ? "down" : "warn";

/** A heartbeat stream id, "hb#1.rx", as the heartbeat it belongs to, "1", which sign and wipe take. */
export const heartbeatOf = (streamId) => streamId.replace(/^hb#/, "").replace(/\.(rx|tx)$/, "");

/** What a component tells beyond its state: its address, its servers, its limits. */
function componentDetail(id, component) {
    if (!component) return "";
    if (id === "listener") return component.addr !== undefined ? `${component.addr}:${component.port}` : "";
    if (id === "dns") return (component.nameservers ?? []).join(", ");
    if (id === "collector") return component.url ?? "";
    if (component.max_running !== undefined) return `max ${component.max_running}`;
    if (component.queue_size !== undefined) return `queue ${component.queue_size}`;
    return "";
}

/** How many executions are listed, the latest first: the scheduler runs many. */
const EXECS_SHOWN = 100;

/** The events that keep the heartbeats current, as on the Heartbeats view. */
const HEARTBEAT_EVENTS = ["DaemonHeartbeatUpdated"];

const byStartDesc = (a, b) => String(b.started_at ?? "").localeCompare(String(a.started_at ?? ""));

export function NodeDaemon({node}) {
    const {t, i18n} = useTranslation();
    const status = useApiResource(URL_CLUSTER_STATUS);
    const orchestrations = useApiResource(nodeUrl(node, "daemon/orchestration"));
    const execs = useApiResource(nodeUrl(node, "daemon/exec"));
    const dns = useApiResource(nodeUrl(node, "daemon/dns/dump"));

    const [feedback, setFeedback] = useState(null);
    // The action asked for, waiting for its confirmation: its question and its request.
    const [pending, setPending] = useState(null);
    const [busy, setBusy] = useState(false);
    const [execFilter, setExecFilter] = useState("");
    const [dnsFilter, setDnsFilter] = useState("");

    const daemon = status.data?.cluster?.node?.[node]?.daemon;
    // The heartbeats, kept current by their events once one came; the cluster status until then.
    const liveHeartbeat = useEventStore((state) => state.heartbeatStatus?.[node]);
    useEffect(() => {
        const token = localStorage.getItem("authToken");
        const release = token ? retainEventReception(token, HEARTBEAT_EVENTS) : null;
        return () => release?.();
    }, []);
    const when = (value) => (isSet(value) ? <RelativeTime value={value} locale={i18n.language}/> : "–");
    const reloadAll = () => [status, orchestrations, execs, dns].forEach((r) => r.reload());

    /** Sends a request of the daemon, says how it went, and reads again what it changed. */
    const send = async ({label, method = "POST", path, body, reload, section}) => {
        setBusy(true);
        // Said in the section acted from: the top of a long tab is out of sight there.
        const say = (tone, message) => setFeedback({tone, message, section});
        say("info", t("nodeDaemon.feedback.requesting", {action: label}));
        try {
            const response = await fetch(nodeUrl(node, path), {
                method,
                headers: {...authHeaders(), ...(body ? {"Content-Type": "application/json"} : {})},
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                const message = (await getResponseErrorMessage(response)) || `HTTP ${response.status}`;
                say("error", t("nodeDaemon.feedback.failed", {action: label, message}));
                return;
            }
            say("success", t("nodeDaemon.feedback.requested", {action: label}));
            (reload ?? [status]).forEach((r) => r.reload());
        } catch (error) {
            say("error", t("nodeDaemon.feedback.failed", {action: label, message: error.message}));
        } finally {
            setBusy(false);
        }
    };

    /** Asks for an action, confirmed before it is sent. */
    const ask = (request) => setPending(request);
    const confirm = () => {
        const request = pending;
        setPending(null);
        void send(request);
    };

    const streams = (liveHeartbeat ?? daemon?.heartbeat)?.streams ?? [];
    // Live, the heartbeats wait for nothing else: neither the cluster status nor its error.
    const heartbeatSource = liveHeartbeat ? {data: liveHeartbeat, loading: false, error: null} : status;
    const listener = daemon?.listener;

    const execRows = useMemo(
        () => itemsOf(execs)
            .filter((e) => matches(execFilter, e.path, e.command, e.origin, e.state, e.exec_id))
            // The running ones first, the ones a signal can stop; then the latest first.
            .sort((a, b) => (b.state === "running") - (a.state === "running") || byStartDesc(a, b)),
        [execs, execFilter]
    );
    const dnsRows = useMemo(
        () => (Array.isArray(dns.data) ? dns.data : []).filter((r) => matches(dnsFilter, r.qname, r.qtype, r.content)),
        [dns.data, dnsFilter]
    );

    const streamActions = (stream) => {
        const target = t("nodeDaemon.heartbeats.target", {id: stream.id, node});
        const items = ["start", "stop", "restart"].map((action) => ({
            key: action,
            label: t(`nodeDaemon.actions.${action}`),
            onSelect: () => ask({
                section: "heartbeats",
                label: t(`nodeDaemon.actions.${action}`) + ` ${stream.id}`,
                question: t(`nodeDaemon.heartbeats.confirm.${action}`, {target}),
                // The name without its "hb#", which om3 accepts too but a URL must escape.
                path: `daemon/hb/name/${encodeURIComponent(stream.id.replace(/^hb#/, ""))}/action/${action}`,
            }),
        }));
        // A disk heartbeat is signed and wiped as a whole, both its streams.
        if (stream.type === "disk") {
            const hb = heartbeatOf(stream.id);
            for (const action of ["sign", "wipe"]) {
                items.push({
                    key: action,
                    label: t(`nodeDaemon.actions.${action}`),
                    onSelect: () => ask({
                        section: "heartbeats",
                        label: t(`nodeDaemon.actions.${action}`) + ` hb#${hb}`,
                        question: t(`nodeDaemon.heartbeats.confirm.${action}`, {target: t("nodeDaemon.heartbeats.diskTarget", {hb, node})}),
                        path: `daemon/hb/name/${encodeURIComponent(hb)}/action/${action}`,
                    }),
                });
            }
        }
        return items;
    };

    const listenerItems = ["start", "stop", "restart"].map((action) => ({
        key: action,
        label: t(`nodeDaemon.actions.${action}`),
        onSelect: () => ask({
            section: "listener",
            label: t(`nodeDaemon.actions.${action}`) + ` ${LISTENER}`,
            question: t(`nodeDaemon.listener.confirm.${action}`, {listener: LISTENER, node}),
            path: `daemon/listener/name/${LISTENER}/action/${action}`,
        }),
    }));

    /** The outcome of the last action, in the section it was asked from. */
    const feedbackIn = (section) => (feedback?.section === section ? (
        <Alert
            tone={feedback.tone}
            action={
                <IconButton label={t("common.close")} bare onClick={() => setFeedback(null)}>
                    <CloseIcon className="h-4 w-4"/>
                </IconButton>
            }
        >
            {feedback.message}
        </Alert>
    ) : null);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-ink-muted">
                    {daemon ? (
                        <>
                            {t("nodeDaemon.pid", {pid: daemon.pid})}
                            {" · "}
                            {t("nodeDaemon.startedAt")} {when(daemon.started_at)}
                        </>
                    ) : null}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" icon={<RefreshIcon className="h-3.5 w-3.5"/>} onClick={reloadAll}>
                    {t("nodeDaemon.refresh")}
                </Button>
            </div>


            <Section id={`daemon-components-${node}`} title={t("nodeDaemon.components.title")}>
                <Loaded resource={status}>
                    <DataTable
                        label={t("nodeDaemon.components.title")}
                        rowKey={(row) => row.id}
                        // Named by its key: the listener reports an empty id of its own.
                        rows={daemon ? COMPONENTS.filter((id) => daemon[id]).map((id) => ({...daemon[id], id})) : []}
                        columns={[
                            {key: "id", label: t("nodeDaemon.columns.component"), className: "font-medium", render: (c) => t(`nodeDaemon.components.${c.id}`, {defaultValue: c.id})},
                            {key: "state", label: t("common.status"), render: (c) => (
                                <span className="inline-flex items-center gap-1.5"><StatusMark state={markOf(c.state)} label={c.state}/>{c.state}</span>
                            )},
                            {key: "detail", label: t("nodeDaemon.columns.detail"), className: "font-mono text-data text-ink-muted", render: (c) => componentDetail(c.id, c)},
                            {key: "updated_at", label: t("nodeDaemon.columns.updated"), render: (c) => when(c.updated_at)},
                        ]}
                    />
                </Loaded>
            </Section>

            <Section
                id={`daemon-listener-${node}`}
                title={t("nodeDaemon.listener.title")}
                tools={listener ? <MenuButton icon={<GearIcon className="h-3.5 w-3.5"/>} label={t("nodeDaemon.actions.label")} items={listenerItems}/> : null}
            >
                {feedbackIn("listener")}
                <Loaded resource={status}>
                    {listener ? (
                        <p className="flex flex-wrap items-center gap-2">
                            <StatusMark state={markOf(listener.state)} label={listener.state}/>
                            <span className="font-mono text-data">{LISTENER}</span>
                            <span className="font-mono text-data text-ink-muted">{componentDetail("listener", listener)}</span>
                            <span className="text-ink-muted">{listener.state}</span>
                        </p>
                    ) : <p className="text-ink-muted">{t("nodePanel.none")}</p>}
                </Loaded>
            </Section>

            <Section id={`daemon-heartbeats-${node}`} title={t("nodeDaemon.heartbeats.title")} count={liveHeartbeat || daemon ? streams.length : undefined}>
                {feedbackIn("heartbeats")}
                <Loaded resource={heartbeatSource}>
                    <DataTable
                        label={t("nodeDaemon.heartbeats.title")}
                        rowKey={(s) => s.id}
                        rows={streams}
                        columns={[
                            {key: "id", label: t("nodeDaemon.columns.stream"), className: "font-mono text-data"},
                            {key: "type", label: t("common.type")},
                            {key: "state", label: t("common.status"), render: (s) => (
                                <span className="inline-flex items-center gap-1.5"><StatusMark state={markOf(s.state)} label={s.state}/>{s.state}</span>
                            )},
                            {key: "peers", label: t("nodeDaemon.columns.peers"), render: (s) => (
                                <span className="flex flex-wrap gap-2">
                                    {Object.entries(s.peers ?? {}).map(([peer, p]) => (
                                        <span key={peer} className="inline-flex items-center gap-1">
                                            <StatusMark
                                                state={p.is_beating ? "up" : "down"}
                                                label={p.is_beating ? t("heartbeats.marks.beating") : t("heartbeats.marks.stale")}
                                            />
                                            {peer || "–"}
                                        </span>
                                    ))}
                                </span>
                            )},
                            {key: "actions", label: t("nodeDaemon.actions.label"), render: (s) => (
                                <MenuButton
                                    icon={<GearIcon className="h-3.5 w-3.5"/>}
                                    label={t("nodeDaemon.heartbeats.actionsOf", {id: s.id})}
                                    align="end"
                                    items={streamActions(s)}
                                />
                            )},
                        ]}
                    />
                </Loaded>
            </Section>

            <Section id={`daemon-orchestrations-${node}`} title={t("nodeDaemon.orchestrations.title")} count={orchestrations.data ? itemsOf(orchestrations).length : undefined}>
                <Loaded resource={orchestrations}>
                    <DataTable
                        label={t("nodeDaemon.orchestrations.title")}
                        rowKey={(o) => o.orchestration_id}
                        rows={[...itemsOf(orchestrations)].sort(byStartDesc)}
                        columns={[
                            {key: "path", label: t("nodeDaemon.columns.object"), className: "font-medium", render: (o) => o.path || t("nodeDaemon.orchestrations.node")},
                            {key: "expect", label: t("nodeDaemon.columns.expect")},
                            {key: "state", label: t("common.status"), render: (o) => (o.error ? `${o.state}: ${o.error}` : o.state)},
                            {key: "started_at", label: t("nodeDaemon.columns.started"), render: (o) => when(o.started_at)},
                            {key: "ended_at", label: t("nodeDaemon.columns.ended"), render: (o) => when(o.ended_at)},
                            {key: "orchestration_id", label: t("nodeDaemon.columns.id"), className: "font-mono text-data text-ink-muted"},
                        ]}
                    />
                </Loaded>
            </Section>

            <Section
                id={`daemon-execs-${node}`}
                title={t("nodeDaemon.execs.title")}
                count={execs.data ? execRows.length : undefined}
                tools={<FilterField label={t("nodeDaemon.execs.filter")} value={execFilter} onChange={setExecFilter}/>}
            >
                {feedbackIn("execs")}
                <Loaded resource={execs}>
                    {execRows.length > EXECS_SHOWN && (
                        <p className="text-ink-muted">{t("nodeDaemon.execs.shown", {shown: EXECS_SHOWN, count: execRows.length})}</p>
                    )}
                    <DataTable
                        label={t("nodeDaemon.execs.title")}
                        rowKey={(e) => e.exec_id}
                        rows={execRows.slice(0, EXECS_SHOWN)}
                        columns={[
                            {key: "path", label: t("nodeDaemon.columns.object"), className: "font-medium"},
                            {key: "command", label: t("nodeDaemon.columns.command"), className: "font-mono text-data text-ink-muted"},
                            {key: "origin", label: t("nodeDaemon.columns.origin")},
                            {key: "state", label: t("common.status"), render: (e) => (e.exit_code !== undefined && e.state !== "running" ? `${e.state} (${e.exit_code})` : e.state)},
                            {key: "started_at", label: t("nodeDaemon.columns.started"), render: (e) => when(e.started_at)},
                            {key: "ended_at", label: t("nodeDaemon.columns.ended"), render: (e) => when(e.ended_at)},
                            {key: "signal", label: t("nodeDaemon.actions.label"), render: (e) => (e.state === "running" ? (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => ask({
                                        section: "execs",
                                        label: t("nodeDaemon.execs.terminate"),
                                        question: t("nodeDaemon.execs.confirm", {command: e.command, node}),
                                        method: "DELETE",
                                        path: `daemon/exec?exec_id=${encodeURIComponent(e.exec_id)}&signal=TERM`,
                                        reload: [execs],
                                    })}
                                >
                                    {t("nodeDaemon.execs.terminate")}
                                </Button>
                            ) : null)},
                        ]}
                    />
                </Loaded>
            </Section>

            <Section
                id={`daemon-dns-${node}`}
                title={t("nodeDaemon.dns.title")}
                count={dns.data ? dnsRows.length : undefined}
                tools={<FilterField label={t("nodeDaemon.dns.filter")} value={dnsFilter} onChange={setDnsFilter}/>}
            >
                <Loaded resource={dns}>
                    <DataTable
                        label={t("nodeDaemon.dns.title")}
                        rowKey={(r, index) => `${r.qname} ${r.qtype} ${r.content} ${index}`}
                        rows={dnsRows}
                        columns={[
                            {key: "qname", label: t("common.name"), className: "font-mono text-data"},
                            {key: "qtype", label: t("common.type")},
                            {key: "ttl", label: t("nodeDaemon.columns.ttl"), numeric: true},
                            {key: "content", label: t("nodeDaemon.columns.content"), className: "font-mono text-data"},
                        ]}
                    />
                </Loaded>
            </Section>

            <Dialog
                open={pending !== null}
                onClose={() => setPending(null)}
                title={pending ? t("nodeDaemon.confirmTitle", {action: pending.label}) : ""}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
                        <Button variant="primary" onClick={confirm}>{t("common.confirm")}</Button>
                    </>
                }
            >
                <p className="text-ink">{pending?.question}</p>
            </Dialog>
        </div>
    );
}
