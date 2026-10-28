import React from "react";

const RING_RADIUS = 52;
const ROUND = 2 * Math.PI * RING_RADIUS;
/** The tint of the word in a ring, by the state its parts make. */
export const RING_INK = {up: "text-state-up", warn: "text-state-warn", down: "text-state-down"};

/**
 * A gauge gone round: its arcs the parts of a whole one after the other from the top,
 * `parts` as [name, count, stroke class], those of none left out, on a grey track; in it,
 * `children`, its figures and words. `total`, the whole, the sum of the parts unless said.
 */
export function StateRing({parts, total = parts.reduce((sum, [, count]) => sum + count, 0), children}) {
    let start = 0;
    const arcs = parts
        .filter(([, count]) => count > 0)
        .map(([part, count, stroke]) => {
            const length = (ROUND * count) / total;
            const arc = {part, length, start, stroke};
            start += length;
            return arc;
        });
    return (
        <div className="relative size-44">
            <svg viewBox="0 0 120 120" aria-hidden="true" className="size-full -rotate-90">
                <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="8" className="stroke-surface-sunken"/>
                {arcs.map(({part, length, start: from, stroke}) => (
                    <circle
                        key={part}
                        data-arc={part}
                        cx="60"
                        cy="60"
                        r={RING_RADIUS}
                        fill="none"
                        strokeWidth="8"
                        strokeDasharray={`${length} ${ROUND}`}
                        strokeDashoffset={-from}
                        className={stroke}
                    />
                ))}
            </svg>
            {/* Its figures and words inside the ring, a long label on two lines, not under its arcs. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center leading-tight text-balance">{children}</div>
        </div>
    );
}
