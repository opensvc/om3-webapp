import React, {useId} from "react";
import {useTranslation} from "react-i18next";
import {Input} from "../ui/components/Field";
import {SearchIcon} from "../ui/icons";

/**
 * A facet of the rail: its title, a clear when values are chosen, then its values,
 * each a toggle with its mark and how many objects it would keep; a value keeping
 * none, unchosen, muted.
 */
function Facet({label, options, selected, counts, onToggle, onClear}) {
    const {t} = useTranslation();
    const id = useId();
    return (
        <section aria-labelledby={id} data-facet={label} className="space-y-1">
            <div className="flex items-center gap-2">
                <h2 id={id} className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{label}</h2>
                {selected.length > 0 && (
                    <button
                        type="button"
                        onClick={onClear}
                        aria-label={t("objects.filters.clearOf", {filter: label})}
                        className="ml-auto text-data text-ink-muted hover:text-ink"
                    >
                        {t("objects.filters.clear")}
                    </button>
                )}
            </div>
            <ul className="space-y-0.5">
                {options.map((option) => {
                    const pressed = selected.includes(option.value);
                    const n = counts[option.value] ?? 0;
                    return (
                        <li key={option.value}>
                            <button
                                type="button"
                                aria-pressed={pressed}
                                onClick={() => onToggle(option.value)}
                                className={`flex w-full items-center gap-1.5 rounded-(--radius-control) border border-transparent px-2 py-0.5 text-left hover:bg-surface-sunken aria-pressed:border-accent aria-pressed:bg-accent-soft ${n === 0 && !pressed ? "text-ink-muted" : ""}`}
                            >
                                {option.mark && <span aria-hidden="true" className="inline-flex">{option.mark}</span>}
                                <span className="min-w-0 flex-1 truncate">{option.text}</span>
                                <span className="text-data text-ink-muted tabular-nums">{n}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/**
 * The filters of a list beside its table, on a screen wide enough: `head` first, what
 * stood over the table (its actions, its pager), its rows given to the table; then the
 * name searched, then each filter a facet, its values counted (`objectFacets`). The
 * same filters as the popovers of the toolbar on a narrower screen.
 */
export function FilterRail({label, head, search, onSearch, searchLabel, facets}) {
    return (
        <aside aria-label={label} className="flex w-64 shrink-0 flex-col gap-4 overflow-auto pt-0.5">
            {head && <div data-rail-head="" className="flex flex-col gap-3 border-b border-line pb-4">{head}</div>}
            <label className="flex flex-col gap-1">
                <span className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{searchLabel}</span>
                <span className="relative flex items-center">
                    <SearchIcon className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-ink-muted"/>
                    <Input type="search" className="h-7 w-full pl-7" value={search} onChange={onSearch}/>
                </span>
            </label>
            {facets.map((facet) => <Facet key={facet.label} {...facet}/>)}
        </aside>
    );
}
