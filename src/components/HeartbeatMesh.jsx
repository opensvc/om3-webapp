import React, {useId, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {DIRECTION_OFFSET, meshLayout, meshLinks, meshNodes} from "../app/heartbeat-mesh";
import {RelativeTime} from "../ui/components/RelativeTime";

/** The tint of a line: the state of its links, in the oc3 state colours. */
const STROKE = {up: "stroke-state-up", warn: "stroke-state-warn", down: "stroke-state-down"};
const FILL = {up: "fill-state-up", warn: "fill-state-warn", down: "fill-state-down"};

const ZERO_TIME = "0001-01-01T00:00:00Z";

/** Room kept between the card and the edges of the window. */
const MARGIN = 8;

/**
 * Where the card of a line goes, against the window: under the line, or over it
 * when the line is in the lower part of the window, its left side clamped so that
 * it stays in. In a portal, so that the scrolling box of the mesh does not cut it.
 */
function cardPlace(element) {
    const rect = element.getBoundingClientRect();
    const below = rect.bottom < window.innerHeight * 0.6;
    return {
        left: Math.max(MARGIN, Math.min(rect.left + rect.width / 2, window.innerWidth - MARGIN)),
        top: below ? rect.bottom + 6 : rect.top - 6,
        below,
    };
}

/**
 * The heartbeat mesh of the cluster: its nodes, and between two nodes two parallel
 * lines, one each way, an arrow from the sender to the receiver, holding every link of that
 * direction (each stream of each node toward its peer). A line is green when all
 * its links beat, orange for a mix, red when none does. No text on the lines:
 * hovered or focused, a card lists the links of one, each with its heartbeat,
 * side, type, description, state and last beat. Clicked, a line is handed to
 * `onSelect`, the page showing its links.
 */
export function HeartbeatMesh({heartbeatStatus, onSelect}) {
    const {t, i18n} = useTranslation();
    const id = useId();
    const links = useMemo(() => meshLinks(heartbeatStatus ?? {}), [heartbeatStatus]);
    const nodes = useMemo(() => meshNodes(heartbeatStatus ?? {}, links), [heartbeatStatus, links]);
    const layout = useMemo(() => meshLayout(nodes, links), [nodes, links]);
    // The line whose card is open, and where the card goes.
    const [shown, setShown] = useState(null);
    const [place, setPlace] = useState(null);
    const open = (key) => (event) => {
        setShown(key);
        setPlace(cardPlace(event.currentTarget));
    };
    const close = () => setShown(null);

    if (nodes.length === 0) return null;
    const group = shown ? layout.groups.find((g) => g.key === shown) : undefined;
    const marker = (state) => `${id.replace(/:/g, "")}-arrow-${state}`;
    const beating = (g) => g.links.filter((l) => l.state === "up").length;
    const describe = (g) => t("heartbeats.mesh.groupLabel", {
        from: g.from, to: g.to, count: g.links.length, beating: beating(g),
    });
    const stateOf = (l) => t(l.state === "up" ? "heartbeats.marks.beating" : "heartbeats.marks.stale")
        + (l.streamState && l.streamState !== "running" ? ` (${l.streamState})` : "");

    return (
        <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col space-y-2">
            <h2 id={`${id}-title`} className="font-semibold">{t("heartbeats.mesh.title")}</h2>
            {/* On the ground of the tables, as the heartbeats beside it. */}
            <div className="relative max-h-[60vh] flex-1 overflow-auto rounded-(--radius-panel) border border-line bg-surface-raised">
                <svg
                    role="group"
                    aria-labelledby={`${id}-title`}
                    width={layout.width}
                    height={layout.height}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    // Its drawn size at most, smaller in a narrower column: no scrolling to see it.
                    className="block h-auto max-w-full shrink-0 text-data"
                >
                    <defs>
                        {["up", "warn", "down"].map((state) => (
                            <marker
                                key={state}
                                id={marker(state)}
                                viewBox="0 0 10 10"
                                refX="9"
                                refY="5"
                                markerWidth="7"
                                markerHeight="7"
                                orient="auto-start-reverse"
                            >
                                <path d="M 0 0 L 10 5 L 0 10 z" className={FILL[state]}/>
                            </marker>
                        ))}
                    </defs>
                    {layout.groups.map((g) => (
                        <g
                            key={g.key}
                            data-group={g.key}
                            data-state={g.state}
                            tabIndex={0}
                            aria-label={describe(g)}
                            onMouseEnter={open(g.key)}
                            onMouseLeave={close}
                            onFocus={open(g.key)}
                            onBlur={close}
                            // A line clicked, or Enter or Space on it: its links, wherever the page shows them.
                            onClick={onSelect ? () => onSelect(g) : undefined}
                            onKeyDown={onSelect ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onSelect(g);
                                }
                            } : undefined}
                            role={onSelect ? "button" : undefined}
                            className={onSelect ? "cursor-pointer outline-none" : "cursor-default outline-none"}
                        >
                            <path
                                d={g.path}
                                fill="none"
                                strokeWidth={shown === g.key ? 3.5 : 2}
                                markerEnd={`url(#${marker(g.state)})`}
                                className={STROKE[g.state]}
                            />
                            {/* A wider invisible stroke, the pointer finds a thin line; narrower
                                than the room between the two lines, each keeps its own. */}
                            <path d={g.path} fill="none" stroke="transparent" strokeWidth={DIRECTION_OFFSET - 2}/>
                        </g>
                    ))}
                    {nodes.map((name) => {
                        const p = layout.nodes[name];
                        return (
                            <g key={name} data-node={name}>
                                {/* A pill as wide as the name: a node name can be long, a circle would not hold it. */}
                                <title>{name}</title>
                                <rect
                                    x={p.x - p.width / 2}
                                    y={p.y - p.height / 2}
                                    width={p.width}
                                    height={p.height}
                                    rx={p.height / 2}
                                    className="fill-surface-raised stroke-line"
                                    strokeWidth={1.5}
                                />
                                <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" className="fill-ink font-semibold">{p.label}</text>
                            </g>
                        );
                    })}
                </svg>
                {group && place && createPortal(
                    <div
                        role="tooltip"
                        className={`pointer-events-none fixed z-[1250] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 ${place.below ? "" : "-translate-y-full"} rounded-(--radius-panel) border border-line bg-surface-raised p-2 text-data shadow-lg`}
                        style={{left: place.left, top: place.top}}
                    >
                        <p className="mb-1.5 font-semibold">
                            {`${group.from} → ${group.to}`}
                            <span className="ml-2 font-normal text-ink-muted">
                                {t("heartbeats.mesh.beatingOf", {beating: beating(group), count: group.links.length})}
                            </span>
                        </p>
                        <table className="border-separate border-spacing-x-3 border-spacing-y-0.5">
                            <thead>
                                <tr className="text-left text-ink-muted">
                                    <th className="font-normal">{t("heartbeats.mesh.heartbeat")}</th>
                                    <th className="font-normal">{t("heartbeats.mesh.side")}</th>
                                    <th className="font-normal">{t("common.type")}</th>
                                    <th className="font-normal">{t("heartbeats.mesh.desc")}</th>
                                    <th className="font-normal">{t("common.status")}</th>
                                    <th className="font-normal">{t("heartbeats.mesh.lastBeat")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.links.map((l) => (
                                    <tr key={l.key} data-link={l.key}>
                                        <td>{l.hb}</td>
                                        <td className="whitespace-nowrap">{`${l.dir} · ${l.node}`}</td>
                                        <td>{l.type}</td>
                                        <td className="font-mono">{l.desc || "–"}</td>
                                        <td className={l.state === "up" ? "text-state-up" : "text-state-down"}>{stateOf(l)}</td>
                                        <td className="whitespace-nowrap">
                                            {l.lastBeatingAt && l.lastBeatingAt !== ZERO_TIME
                                                ? <RelativeTime value={l.lastBeatingAt} locale={i18n.language}/>
                                                : "–"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>,
                    document.body,
                )}
            </div>
            {/* What the lines say. */}
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-data text-ink-muted" data-legend="">
                <span>{t("heartbeats.mesh.legend.direction")}</span>
                {["up", "warn", "down"].map((state) => (
                    <span key={state} className="inline-flex items-center gap-1.5" data-legend-state={state}>
                        <svg aria-hidden="true" width="18" height="4" className="shrink-0">
                            <line x1="0" y1="2" x2="18" y2="2" strokeWidth="2.5" className={STROKE[state]}/>
                        </svg>
                        {t(`heartbeats.mesh.legend.${state}`)}
                    </span>
                ))}
            </p>
        </section>
    );
}
