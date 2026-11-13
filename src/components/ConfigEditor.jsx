import React, {useMemo} from "react";
import {paintLine, parseConfig} from "./ConfigText";

/**
 * A configuration edited as a text, painted as ConfigText shows it: its sections,
 * keys, scopes, references and comments. The textarea, its text transparent, lies
 * over the text painted, both in one cell of a grid: the same size whatever the
 * lines, never wrapped, scrolled together in the frame around them.
 */
export function ConfigEditor({value, onChange, label, minRows = 8, maxHeight = "60vh"}) {
    const lines = useMemo(() => parseConfig(value), [value]);
    const rows = Math.max(minRows, lines.length);
    // The same font, size, line height and padding under and over: what is typed lies on what is painted.
    const text = "col-start-1 row-start-1 m-0 p-2 font-mono text-data leading-[1.5] whitespace-pre";
    return (
        <div
            data-config-editor=""
            style={{maxHeight}}
            className="overflow-auto rounded-(--radius-control) border border-line bg-surface-sunken focus-within:outline-2 focus-within:outline-(--focus-ring)"
        >
            <div className="grid grid-cols-[minmax(100%,max-content)]">
                <pre aria-hidden="true" className={`${text} text-ink`}>
                    {lines.map((l, index) => (
                        <React.Fragment key={index}>
                            {paintLine(l)}
                            {"\n"}
                        </React.Fragment>
                    ))}
                </pre>
                <textarea
                    aria-label={label}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    spellCheck={false}
                    wrap="off"
                    rows={rows}
                    className={`${text} resize-none overflow-hidden border-0 bg-transparent text-transparent caret-ink outline-none selection:bg-accent/25 selection:text-transparent`}
                />
            </div>
        </div>
    );
}
