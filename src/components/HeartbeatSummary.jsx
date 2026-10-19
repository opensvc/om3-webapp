import React, {useId, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {cn} from "../ui/cn";
import {heartbeatsOf, sidesOf} from "../app/heartbeat-summary";
import {meshLinks} from "../app/heartbeat-mesh";

/**
 * A line opening a group of rows, across the card, on the grey of the group lines of
 * the lists; held at the top of the card while its rows scroll under it.
 */
const SEPARATOR = "sticky top-0 z-10 col-span-full -mx-2 border-y border-line bg-surface-sunken px-3 py-0.5 font-semibold text-ink";

const TONE = {up: "text-state-up", warn: "text-state-warn", down: "text-state-down"};
const PART = {up: "bg-state-up", down: "bg-state-down", stopped: "bg-line"};

/** The most links a bar draws a segment each: more, thinner than a pixel, its parts only. */
export const SEGMENTS_MAX = 24;

/**
 * The links of a row as a bar of a width for all, their figures beside it: those
 * beating, those not on a running stream, those of a stopped stream, in that order,
 * the red always at the same place. A segment a link up to SEGMENTS_MAX, the parts
 * in proportion above. The bars of the rows aligned, compared by their proportions.
 */
const Bar = ({beating, stopped, total}) => {
    const parts = [["up", beating], ["down", total - beating - stopped], ["stopped", stopped]];
    return (
        <span aria-hidden="true" data-bar="" className="flex h-2.5 w-28 gap-px overflow-hidden rounded-sm">
            {total <= SEGMENTS_MAX
                ? parts.flatMap(([part, count]) => Array.from({length: count}, (_, i) => (
                    <span key={`${part}${i}`} data-part={part} className={cn("flex-1 rounded-[1px]", PART[part])}/>
                )))
                : parts.filter(([, count]) => count > 0).map(([part, count]) => (
                    <span key={part} data-part={part} className={PART[part]} style={{flexGrow: count, flexBasis: 0}}/>
                ))}
        </span>
    );
};

/**
 * A row of the summary: a name, what it holds, its links beating out of all of
 * them as figures and as a bar, a last word, the cells on one line, centered, on
 * the columns of the card. A click selects its streams; selected, it is marked.
 */
function SummaryRow({row, selected, onSelect}) {
    return (
        <li data-row={row.key} className="col-span-full grid grid-cols-subgrid">
            <button
                type="button"
                aria-pressed={selected}
                onClick={onSelect}
                className={cn(
                    "col-span-full grid grid-cols-subgrid items-center rounded-(--radius-control) px-1 py-0.5 text-left hover:bg-surface-sunken",
                    selected && "bg-accent-soft hover:bg-accent-soft",
                )}
            >
                <span className="font-medium">{row.name}</span>
                <span className="text-ink-muted">{row.detail}</span>
                <span className={cn("tabular-nums", TONE[row.state])}>{row.beating}/{row.total}</span>
                <Bar beating={row.beating} stopped={row.stopped} total={row.total}/>
                <span className="truncate text-ink-muted">{row.last}</span>
            </button>
        </li>
    );
}

/**
 * The heartbeats at a glance, beside the ring of the mesh, in one card: under a
 * line, each heartbeat over the cluster, its driver, its links beating out of all
 * of them, its layer; then, under another, each node sending, then receiving, and
 * its heartbeats. The rows on the same columns, their figures and bars aligned. A
 * row clicked selects its streams: a heartbeat and a side of a node together.
 */
export function HeartbeatSummary({heartbeatStatus, selected = {}, onSelect}) {
    const {t} = useTranslation();
    const titleId = useId();
    const links = useMemo(() => meshLinks(heartbeatStatus ?? {}), [heartbeatStatus]);
    const heartbeats = useMemo(() => heartbeatsOf(links), [links]);
    const sides = useMemo(() => sidesOf(links), [links]);
    if (heartbeats.length === 0) return null;
    return (
        <section aria-labelledby={titleId} className="flex min-w-0 flex-col space-y-2" data-testid="heartbeat-summary">
            <h2 id={titleId} className="font-semibold">{t("heartbeats.summary.title")}</h2>
            {/* On the ground of the tables, as high as the mesh beside it, scrolling past it as the mesh does. */}
            <div className="max-h-[60vh] flex-1 overflow-auto rounded-(--radius-panel) border border-line bg-surface-raised px-2 pb-2">
                {/* Not a table, the streams are: a grid, its rows on the columns of the card. */}
                <ul className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-x-3 gap-y-0.5 text-data">
                    {/* The heartbeats, then the nodes, each under a line, as the groups of the lists. */}
                    <li data-separator="heartbeats" className={cn(SEPARATOR, "mb-1 border-t-0")}>
                        {t("heartbeats.summary.list")}
                    </li>
                    {heartbeats.map((h) => (
                        <SummaryRow
                            key={h.hb}
                            row={{key: h.hb, name: h.hb, detail: h.type, last: t(`heartbeats.summary.layer.${h.layer}`), ...h}}
                            selected={selected.hb === h.hb}
                            onSelect={() => onSelect?.({kind: "hb", value: h.hb})}
                        />
                    ))}
                    <li data-separator="sides" className={cn(SEPARATOR, "my-1")}>
                        {t("heartbeats.summary.sides")}
                    </li>
                    {sides.map((side) => (
                        <SummaryRow
                            key={`${side.dir}:${side.node}`}
                            row={{
                                key: `${side.dir}:${side.node}`,
                                name: side.node,
                                detail: t(`heartbeats.summary.side.${side.dir}`),
                                last: side.hbs.join(", "),
                                ...side,
                            }}
                            selected={selected.side?.node === side.node && selected.side?.dir === side.dir}
                            onSelect={() => onSelect?.({kind: "side", value: {node: side.node, dir: side.dir}})}
                        />
                    ))}
                </ul>
            </div>
            {/* What a row does: a line under the card, as the key under the mesh, both as high. */}
            <p className="text-data text-ink-muted" data-hint="">{t("heartbeats.summary.hint")}</p>
        </section>
    );
}
