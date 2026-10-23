import React, {useId, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {usePeek} from "../app/panel-search";
import {sectionValues} from "../app/heartbeat-config";
import {CHAR_WIDTH, CHIP_HEIGHT, LINE, PADDING, sketchLayout} from "../app/network-sketch";

/** A fact of a box: its keyword muted, its value; one the daemon decides said so. */
function Fact({fact, x, y, computed}) {
    return (
        <text x={x} y={y} className="fill-ink">
            <tspan className="fill-ink-muted">{fact.key}</tspan>
            {" "}
            {fact.computed
                ? <tspan className="fill-ink-muted italic">{computed}</tspan>
                : <tspan className="font-mono">{fact.value}</tspan>}
        </text>
    );
}

/** An object holding addresses of the network, a chip: its path, its count; opening its panel. */
function ObjectChip({o, label, onOpen}) {
    return (
        <g
            data-object={o.path}
            role="button"
            tabIndex={0}
            aria-label={label}
            onClick={onOpen}
            onKeyDown={onKey(onOpen)}
            className="group cursor-pointer outline-none"
        >
            <rect x={o.x} y={o.y} width={o.width} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2}
                  className="fill-surface stroke-line group-hover:fill-surface-sunken group-focus-visible:stroke-accent"/>
            <text x={o.x + PADDING} y={o.y + CHIP_HEIGHT / 2 + 4} className="fill-ink">{o.path}</text>
            <text x={o.x + o.width - PADDING} y={o.y + CHIP_HEIGHT / 2 + 4} textAnchor="end" className="fill-ink-muted tabular-nums">
                {o.count}
            </text>
        </g>
    );
}

/** Half the width of a tunnel: its two lines that far each side of its middle. */
const TUNNEL_HALF = 3;

/** Enter or Space on a drawn button: as a click. */
const onKey = (open) => (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    open();
};

/**
 * An object of addresses reported by several nodes: a pill across the columns of the
 * nodes, each stretch over a column drawn as a chip of an object held on one node where
 * the node reports them, no more marked than it, dashed and empty where it does not;
 * its ends rounded, as its first and last stretch.
 */
function SharedPill({o, label, onOpen}) {
    const h = CHIP_HEIGHT;
    const r = h / 2;
    const {y} = o;
    const lastIndex = o.segments.length - 1;
    return (
        <g data-object={o.path} data-nodes={o.nodes.join(" ")} role="button" tabIndex={0} aria-label={label}
           onClick={onOpen} onKeyDown={onKey(onOpen)} className="group cursor-pointer outline-none">
            {o.segments.map((seg, i) => {
                const a = i === 0 ? seg.x1 + r : seg.x1;
                const b = i === lastIndex ? seg.x2 - r : seg.x2;
                // Its area: straight sides between stretches, half circles at the ends.
                const area = [
                    `M ${a} ${y} L ${b} ${y}`,
                    i === lastIndex ? `A ${r} ${r} 0 0 1 ${b} ${y + h}` : `L ${b} ${y + h}`,
                    `L ${a} ${y + h}`,
                    i === 0 ? `A ${r} ${r} 0 0 1 ${a} ${y}` : `L ${a} ${y}`,
                    "Z",
                ].join(" ");
                // Its outline: top and bottom, and its end, no line between two stretches.
                const outline = [
                    `M ${a} ${y} L ${b} ${y}`,
                    `M ${a} ${y + h} L ${b} ${y + h}`,
                    i === 0 ? `M ${a} ${y} A ${r} ${r} 0 0 0 ${a} ${y + h}` : "",
                    i === lastIndex ? `M ${b} ${y} A ${r} ${r} 0 0 1 ${b} ${y + h}` : "",
                ].join(" ");
                return (
                    <g key={seg.node} data-segment={seg.node} data-present={seg.present || undefined}>
                        <path d={area} className={seg.present ? "fill-surface group-hover:fill-surface-sunken" : "fill-transparent"}/>
                        <path d={outline} fill="none" strokeDasharray={seg.present ? undefined : "4 3"}
                              className="stroke-line group-focus-visible:stroke-accent"/>
                    </g>
                );
            })}
            <text x={o.x + PADDING} y={y + h / 2 + 4} className="fill-ink">{o.path}</text>
            <text x={o.x + o.width - PADDING} y={y + h / 2 + 4} textAnchor="end" className="fill-ink-muted tabular-nums">{o.count}</text>
        </g>
    );
}

/**
 * The sketch of a network (`network-sketch.ts`): its range in a band over the nodes,
 * what it is on each node in a box under it, routed between them for a routed bridge,
 * and the objects holding its addresses on each node under its box, each opening its
 * panel. `network`, as the network list gives it; `section`, its section of the
 * cluster configuration; `addresses`, those it handed out.
 */
export function NetworkSketch({network, section, nodes, addresses}) {
    const {t} = useTranslation();
    const id = useId();
    const peek = usePeek();
    const computed = t("networks.sketch.computed");
    // The routes of a routed bridge: through a mesh of tunnels, unless never, its policy and mode said when set.
    const values = useMemo(() => sectionValues(section ?? null), [section]);
    const routeLabel = values.tunnel === "never"
        ? t("networks.sketch.routedLabel")
        : [t("networks.sketch.tunnelMesh"), values.tunnel, values.tunnel_mode].filter(Boolean).join(" · ");
    const layout = useMemo(() => sketchLayout({
        name: network.name,
        type: network.type,
        network: network.network,
        values,
        nodes,
        addresses,
    }, computed.length * CHAR_WIDTH, routeLabel.length * CHAR_WIDTH), [network, values, nodes, addresses, computed, routeLabel]);
    const {band} = layout;

    return (
        <figure className="space-y-1">
            <figcaption id={`${id}-caption`} className="sr-only">
                {t("networks.sketch.label", {name: network.name, count: nodes.length})}
            </figcaption>
            <svg
                role="group"
                aria-labelledby={`${id}-caption`}
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                // Its own size, smaller in a narrow panel.
                className="block h-auto max-w-full text-data"
            >
                {/* The range, over all the nodes. */}
                <g data-band="">
                    <rect x={band.x} y={band.y} width={band.width} height={band.height} rx="6"
                          className="fill-surface-sunken stroke-line"/>
                    <text x={band.x + PADDING} y={band.y + PADDING + LINE - 4} className="fill-ink font-semibold">
                        {`${network.name} · ${network.type}`}
                    </text>
                    {band.facts.map((fact, i) => (
                        <Fact key={fact.key} fact={fact} computed={computed}
                              x={band.x + PADDING} y={band.y + PADDING + LINE * (i + 2) - 4}/>
                    ))}
                </g>

                {layout.nodes.map((node) => (
                    <line key={`drop-${node.name}`} x1={node.drop.x} y1={node.drop.y1} x2={node.drop.x} y2={node.drop.y2}
                          strokeWidth="1.5" className="stroke-line-strong"/>
                ))}
                {/* A routed bridge: routed between the nodes, under their boxes, past the first and the last;
                    through tunnels, a pipe of two lines. */}
                {layout.route && (
                    <g data-route={layout.route.tunnel ? "tunnel" : "routed"}>
                        <title>{t("networks.sketch.routed")}</title>
                        {(layout.route.tunnel ? [-TUNNEL_HALF, TUNNEL_HALF] : [0]).map((dy) => (
                            <line key={dy} x1={layout.route.x1} y1={layout.route.y + dy} x2={layout.route.x2} y2={layout.route.y + dy}
                                  strokeWidth="1.5" className="stroke-accent"/>
                        ))}
                        <text x={layout.route.labelX} y={layout.route.y + 4} className="fill-accent">{routeLabel}</text>
                    </g>
                )}

                {layout.nodes.map((node) => (
                    <g key={node.name} data-node={node.name}>
                        <rect x={node.x} y={node.y} width={node.width} height={node.height} rx="6"
                              className="fill-surface-raised stroke-line-strong"/>
                        <text x={node.x + PADDING} y={node.y + PADDING + LINE - 4} className="fill-ink font-semibold">{node.name}</text>
                        {node.facts.map((fact, i) => (
                            <Fact key={fact.key} fact={fact} computed={computed}
                                  x={node.x + PADDING} y={node.y + PADDING + LINE * (i + 2) - 4}/>
                        ))}
                        <text x={node.x + PADDING} y={node.y + node.height - PADDING - 2 - (node.shared > 0 ? LINE : 0)} className="fill-ink-muted">
                            {t("networks.sketch.addresses", {count: node.count})}
                        </text>
                        {node.shared > 0 && (
                            <text x={node.x + PADDING} y={node.y + node.height - PADDING - 2} className="fill-ink-muted">
                                {t("networks.sketch.sharedOn", {count: node.shared})}
                            </text>
                        )}
                    </g>
                ))}

                {/* The objects holding its addresses on each node, each opening its panel. */}
                {/* The addresses reported by several nodes: once, a pill across the columns, solid over the nodes reporting them. */}
                {layout.shared && (
                    <g data-shared="" aria-label={t("networks.sketch.shared", {count: layout.shared.count})} role="group">
                        {layout.shared.rows.map((o) => (
                            <SharedPill key={o.path} o={o} onOpen={() => peek("object", o.path)}
                                        label={t("networks.sketch.sharedObject", {path: o.path, count: o.count, nodes: o.nodes.join(", ")})}/>
                        ))}
                        {layout.shared.more && (
                            <text x={layout.shared.more.x} y={layout.shared.more.y} textAnchor="middle" className="fill-ink-muted">
                                {t("networks.sketch.more", {count: layout.shared.more.count})}
                            </text>
                        )}
                    </g>
                )}
                {layout.objects.map((o) => (
                    <ObjectChip key={`${o.node}/${o.path}`} o={o} label={t("networks.sketch.object", {path: o.path, node: o.node, count: o.count})}
                                onOpen={() => peek("object", o.path)}/>
                ))}
                {layout.more.map((m) => (
                    <text key={`more-${m.node}`} x={m.x} y={m.y} textAnchor="middle" className="fill-ink-muted">
                        {t("networks.sketch.more", {count: m.count})}
                    </text>
                ))}
            </svg>
        </figure>
    );
}
