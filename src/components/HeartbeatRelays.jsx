import React, {useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER} from "../config/apiPath.js";
import {authHeaders, getResponseErrorMessage} from "../services/api.jsx";
import {readClusterStatus} from "../hooks/clusterStatusOnce";
import {usePagePoll} from "../hooks/usePagePoll";
import {RELAY_KEYWORDS, relayHeartbeats, relayState, relayView} from "../app/heartbeat-relays";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Spinner} from "../ui/components/Spinner";
import {StatusBadge} from "../ui/components/StatusBadge";
import {RelativeTime} from "../ui/components/RelativeTime";
import {Table, HeaderRow, HeaderCell, Row, Cell, EmptyRow} from "../ui/components/Table";
import {RefreshIcon} from "../ui/icons";

/** How often the relays are asked again while the page is seen: as often as a heartbeat writes. */
export const RELAY_POLL_MS = 10_000;

const URL_RELAY_STATUS = "/api/relay/status";

const BOX = "rounded-(--radius-panel) border border-line bg-surface-raised p-2 text-data";

/** The state of a slot, as its badge shows it: a node not writing is down. */
const SLOT_MARK = {up: "up", stale: "warn", missing: "down"};

async function readJson(url) {
    const response = await fetch(url, {headers: authHeaders(), cache: "no-cache"});
    if (!response.ok) {
        const error = new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

/**
 * A read the daemon refused the user (401, 403): the configuration needs the root or
 * join grant, the relays the heartbeat or root one. Not a failure to say: the box is
 * not the user's to see.
 */
export const isRefused = (error) => error?.status === 401 || error?.status === 403;

/**
 * What the relays say, read again and again: the heartbeats of type relay of the
 * cluster configuration, each one's relay asked for its slots by the node answering
 * the api; the slots the relay of that node holds, when it is a relay itself.
 */
async function readRelays() {
    const status = await readClusterStatus();
    const nodes = Array.isArray(status?.cluster?.config?.nodes) ? status.cluster.config.nodes : [];
    const clusterId = status?.cluster?.config?.id;
    const query = new URLSearchParams([["evaluate", "true"], ...RELAY_KEYWORDS.map((kw) => ["kw", kw])]);
    const config = await readJson(`${URL_CLUSTER}/config?${query}`);
    const heartbeats = relayHeartbeats(config?.items ?? []);
    const now = Date.now();
    const relays = await Promise.all(heartbeats.map(async (hb) => {
        try {
            const body = await readJson(`${URL_RELAY_STATUS}?${new URLSearchParams({remote: "true", relay: hb.relay})}`);
            return {...hb, view: relayView(body?.items ?? [], nodes, hb.timeoutMs, now, clusterId)};
        } catch (err) {
            // The user refused, not the relay unreached: the box is not theirs.
            if (isRefused(err)) throw err;
            return {...hb, view: {error: err.message, rows: []}};
        }
    }));
    // The relay of the node answering, when it is one: the slots it holds, of every cluster.
    const served = await readJson(URL_RELAY_STATUS).then((body) => body?.items ?? [], () => []);
    return {relays, served, readAt: now};
}

/** The slots a relay holds for the cluster: a row per node, its state, address, last write. */
function SlotTable({label, rows, timeoutMs}) {
    const {t, i18n} = useTranslation();
    return (
        <Table aria-label={label}>
            <thead>
            <HeaderRow>
                <HeaderCell>{t("common.node")}</HeaderCell>
                <HeaderCell>{t("heartbeats.relays.columns.state")}</HeaderCell>
                <HeaderCell>{t("heartbeats.relays.columns.addr")}</HeaderCell>
                <HeaderCell>{t("heartbeats.relays.columns.written")}</HeaderCell>
            </HeaderRow>
            </thead>
            <tbody>
            {rows.map((row) => (
                <Row key={row.node} data-slot={row.node} data-state={row.state}>
                    <Cell className="font-medium">{row.node}</Cell>
                    <Cell title={row.state === "stale" ? t("heartbeats.relays.staleHint", {seconds: timeoutMs / 1000}) : undefined}>
                        <StatusBadge state={SLOT_MARK[row.state]} label={t(`heartbeats.relays.state.${row.state}`)} className="w-auto"/>
                    </Cell>
                    <Cell className="font-mono text-data text-ink-muted">{row.addr ?? ""}</Cell>
                    <Cell title={row.msgLen === undefined ? undefined : t("heartbeats.relays.size", {count: row.msgLen})}>
                        {row.updatedAt ? <RelativeTime value={row.updatedAt} locale={i18n.language}/> : ""}
                    </Cell>
                </Row>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={4}>{t("heartbeats.relays.noSlot")}</EmptyRow>}
            </tbody>
        </Table>
    );
}

/**
 * The relays the heartbeats of the cluster go through, as `om node relay status`
 * shows them: by heartbeat of type relay, its relay reached or not, and each node
 * of the cluster writing to it, its last write within the timeout of the heartbeat,
 * older, or none. Then, when the node answering the api is a relay itself, the
 * slots it holds for the clusters writing to it. Read again every while; nothing
 * when the cluster has no relay heartbeat and relays for none, nor for a user the
 * daemon refuses the reads, never asked again then.
 */
export function HeartbeatRelays() {
    const {t, i18n} = useTranslation();
    const titleId = useId();
    const [state, setState] = useState({data: null, error: null, loading: true});
    const [reads, setReads] = useState(0);
    // Refused once, never asked again while the page shows: the grants of a user stay.
    const [refused, setRefused] = useState(false);
    const refusedRef = useRef(false);

    usePagePoll(async (live) => {
        if (refusedRef.current) return;
        setState((s) => ({...s, loading: true}));
        try {
            const data = await readRelays();
            if (live()) setState({data, error: null, loading: false});
        } catch (err) {
            if (!live()) return;
            if (isRefused(err)) {
                refusedRef.current = true;
                setRefused(true);
                return;
            }
            setState((s) => ({...s, error: err.message, loading: false}));
        }
    }, RELAY_POLL_MS, [reads]);

    if (refused) return null;
    const {data, error, loading} = state;
    if (data && data.relays.length === 0 && data.served.length === 0 && !error) return null;
    if (!data && !error) return null;

    return (
        <section aria-labelledby={titleId} className="min-w-0 space-y-2" data-box="relays">
            <div className="flex items-center justify-between gap-2">
                <h2 id={titleId} className="font-semibold">{t("heartbeats.relays.title")}</h2>
                <Button size="sm" icon={loading ? <Spinner label={t("heartbeats.relays.reading")}/> : <RefreshIcon className="h-3.5 w-3.5"/>}
                        onClick={() => setReads((n) => n + 1)} disabled={loading}>
                    {t("heartbeats.relays.refresh")}
                </Button>
            </div>
            {error && <Alert tone="error">{t("heartbeats.relays.readError", {message: error})}</Alert>}
            {(data?.relays ?? []).map((relay) => {
                const overall = relayState(relay.view);
                return (
                    <div key={relay.section} className={`${BOX} space-y-2`} data-relay={relay.section}>
                        <div className="space-y-1">
                            <p className="font-mono font-medium break-all">{relay.relay}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <StatusBadge state={overall} label={t(`heartbeats.relays.overall.${overall}`)} className="w-auto"/>
                                <span className="text-ink-muted">
                                    {t("heartbeats.relays.of", {section: relay.section, seconds: relay.timeoutMs / 1000})}
                                </span>
                            </div>
                        </div>
                        {relay.view.error !== undefined ? (
                            <Alert tone="error">{t("heartbeats.relays.unreached", {message: relay.view.error})}</Alert>
                        ) : (
                            <SlotTable label={t("heartbeats.relays.slotsOf", {relay: relay.relay})} rows={relay.view.rows} timeoutMs={relay.timeoutMs}/>
                        )}
                    </div>
                );
            })}
            {data?.served.length > 0 && (
                <div className={`${BOX} space-y-2`} data-relay-served="">
                    <p className="font-medium">{t("heartbeats.relays.served")}</p>
                    <Table aria-label={t("heartbeats.relays.served")}>
                        <thead>
                        <HeaderRow>
                            <HeaderCell>{t("heartbeats.relays.columns.cluster")}</HeaderCell>
                            <HeaderCell>{t("common.node")}</HeaderCell>
                            <HeaderCell>{t("heartbeats.relays.columns.addr")}</HeaderCell>
                            <HeaderCell>{t("heartbeats.relays.columns.written")}</HeaderCell>
                        </HeaderRow>
                        </thead>
                        <tbody>
                        {data.served.map((slot) => (
                            <Row key={`${slot.cluster_id} ${slot.nodename} ${slot.node_addr}`}>
                                <Cell>{slot.cluster_name || slot.cluster_id}</Cell>
                                <Cell className="font-medium">{slot.nodename}</Cell>
                                <Cell className="font-mono text-data text-ink-muted">{slot.node_addr}</Cell>
                                <Cell>{slot.updated_at ? <RelativeTime value={slot.updated_at} locale={i18n.language}/> : ""}</Cell>
                            </Row>
                        ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </section>
    );
}
