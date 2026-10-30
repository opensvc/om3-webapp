import React, {useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {authHeaders, getResponseErrorMessage} from "../services/api.jsx";
import {readClusterStatus} from "../hooks/clusterStatusOnce";
import {usePagePoll} from "../hooks/usePagePoll";
import {servedSlots} from "../app/heartbeat-relays";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Spinner} from "../ui/components/Spinner";
import {StatusBadge} from "../ui/components/StatusBadge";
import {RelativeTime} from "../ui/components/RelativeTime";
import {Table, HeaderRow, HeaderCell, Row, Cell} from "../ui/components/Table";
import {RefreshIcon} from "../ui/icons";

/** How often the relays are asked again while the page is seen: as often as a heartbeat writes. */
export const RELAY_POLL_MS = 10_000;

const URL_RELAY_STATUS = "/api/relay/status";

const BOX = "rounded-(--radius-panel) border border-line bg-surface-raised p-2 text-data";

/** The state of a slot held, as its badge shows it: written lately, or not. */
const SERVED_MARK = {active: "up", stale: "warn"};

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
 * The slots the node answering holds as a relay, read again and again, and its name
 * for the title.
 */
async function readRelays() {
    const status = await readClusterStatus();
    const now = Date.now();
    const served = servedSlots((await readJson(URL_RELAY_STATUS))?.items ?? [], now);
    return {served, node: status?.daemon?.nodename ?? "", readAt: now};
}

/**
 * The relay page, as `om node relay status` shows it: the slots the node answering
 * holds when it is a relay, the clusters writing to it, each slot active or stale;
 * not a relay, said plainly, the usual case, a site having one relay cluster. Read
 * again every while; a user the daemon refuses the read told so, never asked again.
 */
export default function HeartbeatRelays() {
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

    const {data, error, loading} = state;

    return (
        <div className="mx-auto max-w-4xl space-y-4 p-4" data-box="relays">
            <div className="flex items-center justify-between gap-2">
                <h1 id={titleId} className="text-lg font-semibold">{t("heartbeats.relays.title")}</h1>
                {!refused && (
                    <Button size="sm" icon={loading ? <Spinner label={t("heartbeats.relays.reading")}/> : <RefreshIcon className="h-3.5 w-3.5"/>}
                            onClick={() => setReads((n) => n + 1)} disabled={loading}>
                        {t("heartbeats.relays.refresh")}
                    </Button>
                )}
            </div>
            {refused && <p className="text-ink-muted">{t("heartbeats.relays.refused")}</p>}
            {error && <Alert tone="error">{t("heartbeats.relays.readError", {message: error})}</Alert>}

            {/* The slots this node holds as a relay: not one, the usual case, nothing wrong. */}
            {data && (
                <section aria-labelledby={`${titleId}-served`} className="space-y-2" data-relay-served="">
                    <h2 id={`${titleId}-served`} className="font-semibold">{t("heartbeats.relays.served", {node: data.node})}</h2>
                    {data.served.length === 0 ? (
                        <p className="text-ink-muted">{t("heartbeats.relays.notRelay")}</p>
                    ) : (
                        <div className={BOX}>
                            <Table aria-label={t("heartbeats.relays.served", {node: data.node})}>
                                <thead>
                                <HeaderRow>
                                    <HeaderCell>{t("heartbeats.relays.columns.cluster")}</HeaderCell>
                                    <HeaderCell>{t("common.node")}</HeaderCell>
                                    <HeaderCell>{t("heartbeats.relays.columns.state")}</HeaderCell>
                                    <HeaderCell>{t("heartbeats.relays.columns.addr")}</HeaderCell>
                                    <HeaderCell>{t("heartbeats.relays.columns.written")}</HeaderCell>
                                </HeaderRow>
                                </thead>
                                <tbody>
                                {data.served.map((slot) => (
                                    <Row key={`${slot.cluster} ${slot.node} ${slot.addr}`} data-served={`${slot.cluster}/${slot.node}`} data-state={slot.state}>
                                        <Cell>{slot.cluster}</Cell>
                                        <Cell className="font-medium">{slot.node}</Cell>
                                        <Cell title={slot.state === "stale" ? t("heartbeats.relays.servedStaleHint", {seconds: 15}) : undefined}>
                                            <StatusBadge state={SERVED_MARK[slot.state]} label={t(`heartbeats.relays.served_state.${slot.state}`)} className="w-auto"/>
                                        </Cell>
                                        <Cell className="font-mono text-data text-ink-muted">{slot.addr}</Cell>
                                        <Cell>{slot.updatedAt ? <RelativeTime value={slot.updatedAt} locale={i18n.language}/> : ""}</Cell>
                                    </Row>
                                ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </section>
            )}

        </div>
    );
}
