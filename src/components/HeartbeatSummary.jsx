import React, {useId, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {cn} from "../ui/cn";
import {driversOf, heartbeatsOf} from "../app/heartbeat-summary";
import {meshLinks} from "../app/heartbeat-mesh";

/** A line opening a group of rows, across the card, on the grey of the group lines of the lists. */
const SEPARATOR = "col-span-full -mx-2 border-y border-line bg-surface-sunken px-3 py-0.5 font-semibold text-ink";

const TONE = {up: "text-state-up", warn: "text-state-warn", down: "text-state-down"};
const BAR = {up: "bg-state-up", warn: "bg-state-warn", down: "bg-state-down"};

/** Some out of all, a segment each, those beating tinted first. */
const Segments = ({beating, total, state}) => (
    <span aria-hidden="true" className="inline-flex gap-0.5">
        {Array.from({length: total}, (_, i) => (
            <span key={i} className={cn("h-2.5 w-2 rounded-sm", i < beating ? BAR[state] : "bg-line")}/>
        ))}
    </span>
);

/**
 * A row of the summary: a name, what it holds, its links beating out of all of
 * them as figures and as segments, its layer, the cells on one line, centered, on
 * the columns of the card. A click selects its streams; selected, it is marked.
 */
function SummaryRow({row, selected, onSelect}) {
    const {t} = useTranslation();
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
                <Segments beating={row.beating} total={row.total} state={row.state}/>
                <span className="text-ink-muted">{t(`heartbeats.summary.layer.${row.layer}`)}</span>
            </button>
        </li>
    );
}

/**
 * The heartbeats at a glance, beside the ring of the mesh, in one card: under a
 * line, each heartbeat over the cluster, its driver, its links beating out of all
 * of them, its layer; then, under another, each driver and its heartbeats. The rows on the same
 * columns, their figures aligned. A row clicked selects its streams in the table.
 */
export function HeartbeatSummary({heartbeatStatus, selected = {}, onSelect}) {
    const {t} = useTranslation();
    const titleId = useId();
    const links = useMemo(() => meshLinks(heartbeatStatus ?? {}), [heartbeatStatus]);
    const heartbeats = useMemo(() => heartbeatsOf(links), [links]);
    const drivers = useMemo(() => driversOf(links), [links]);
    if (heartbeats.length === 0) return null;
    return (
        <section aria-labelledby={titleId} className="flex min-w-0 flex-col space-y-2" data-testid="heartbeat-summary">
            <h2 id={titleId} className="font-semibold">{t("heartbeats.summary.title")}</h2>
            {/* On the ground of the tables, as high as the mesh beside it. */}
            <div className="flex-1 rounded-(--radius-panel) border border-line bg-surface-raised p-2">
                {/* Not a table, the streams are: a grid, its rows on the columns of the card. */}
                <ul className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-x-3 gap-y-0.5 text-data">
                    {/* The heartbeats, then the drivers, each under a line, as the groups of the lists. */}
                    <li data-separator="heartbeats" className={cn(SEPARATOR, "-mt-2 mb-1 rounded-t-(--radius-panel) border-t-0")}>
                        {t("heartbeats.summary.list")}
                    </li>
                    {heartbeats.map((h) => (
                        <SummaryRow
                            key={h.hb}
                            row={{key: h.hb, name: h.hb, detail: h.type, ...h}}
                            selected={selected.hb === h.hb}
                            onSelect={() => onSelect?.({kind: "hb", value: h.hb})}
                        />
                    ))}
                    <li data-separator="drivers" className={cn(SEPARATOR, "my-1")}>
                        {t("heartbeats.summary.drivers")}
                    </li>
                    {drivers.map((d) => (
                        <SummaryRow
                            key={d.type}
                            row={{key: d.type, name: d.type, detail: d.hbs.join(", "), ...d}}
                            selected={selected.driver === d.type}
                            onSelect={() => onSelect?.({kind: "driver", value: d.type})}
                        />
                    ))}
                </ul>
            </div>
            {/* What a row does: a line under the card, as the key under the mesh, both as high. */}
            <p className="text-data text-ink-muted" data-hint="">{t("heartbeats.summary.hint")}</p>
        </section>
    );
}
