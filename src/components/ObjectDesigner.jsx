import React, {useEffect, useId, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {getResponseErrorMessage} from "../services/api.jsx";
import {URL_NETWORK, URL_NODE, URL_OBJECT} from "../config/apiPath.js";
import {parseClaims} from "../app/namespace-usage";
import {
    FREE_SECTIONS,
    designText,
    kindDrivers,
    takesResources,
    missingValues,
    nextSectionName,
    offeredKeywords,
    NEEDS_GROUPS,
    poolTypes,
    popularKeywords,
    parseDriver,
    requiredKeywords,
    sectionKeywords,
    withRequired,
} from "../app/object-design";
import {Button, IconButton} from "../ui/components/Button";
import {Checkbox, Input, Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";
import {CloseIcon, InfoIcon, PlusIcon, SearchIcon} from "../ui/icons";
import {KeywordFacts} from "./ConfigText";

/*
 * An object configuration designed in two panes: its sections at the left,
 * DEFAULT and env first, a resource added by its driver; at the right, the keys of
 * the section picked, its required keywords seeded, more picked from the list of
 * its keywords, the documentation of each a click away. The file it makes, shown
 * on demand. The keywords read from the daemon, a driver at a time.
 */

/** The keyword lists read, by address: read once a session. */
const cache = new Map();

function readJson(url) {
    if (!cache.has(url)) {
        const promise = fetch(url, {headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`}})
            .then(async (response) => {
                if (!response.ok) throw new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
                return response.json();
            });
        // A read that failed is tried again the next time.
        promise.catch(() => cache.delete(url));
        cache.set(url, promise);
    }
    return cache.get(url);
}

/** Forgets what was read: for the tests. */
export const clearDesignerCache = () => cache.clear();

/** The keywords of a driver (`fs.flag`, or `DEFAULT`), from the keywords address of the object made. */
const driverKeywords = (keywordsUrl, driver) => readJson(`${keywordsUrl}?driver=${encodeURIComponent(driver)}`).then((d) => d?.items ?? []);

/**
 * The drivers an object of `kind` can take, from the capabilities of the node of the
 * api: unread, none, a driver typed.
 */
const readCapabilities = () => readJson(`${URL_NODE}/localhost/capabilities`).then((d) => (d?.items ?? []).map((i) => i?.data?.name ?? ""));
const readDrivers = (kind) => readCapabilities().then((names) => kindDrivers(kind, names));

/**
 * The networks an address may be drawn from, by name: for root, every one of the
 * cluster; for another user, those its namespace claims (`[claim#N]` of its nscfg).
 * Unread, none.
 */
const readNetworks = async (namespace, isRoot) => {
    try {
        if (isRoot) return ((await readJson(URL_NETWORK))?.items ?? []).map((n) => n.name);
        const response = await fetch(`${URL_OBJECT}/${encodeURIComponent(namespace)}/nscfg/namespace/config/file`, {
            headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`},
        });
        if (!response.ok) return [];
        return parseClaims(await response.text()).filter((c) => c.type === "network" && c.name).map((c) => c.name);
    } catch {
        return [];
    }
};

/** The ip drivers whose address om draws from a network of the cluster, `network` naming it. */
const NETWORK_DRIVERS = ["ip.netns", "ip.cni"];

/** The first line of a text, for a list. */
const firstLine = (text) => (text ?? "").trim().split("\n")[0];

/**
 * A value of a keyword: a choice among its candidates, a boolean, or a text after its
 * default, `suggestions` offered under it, any other value still typed. Empty, the
 * example of a keyword without a default is taken by a click, or the right arrow.
 */
function ValueInput({keyword, value, onChange, label, suggestions = []}) {
    const {t} = useTranslation();
    const listId = useId();
    if (keyword?.candidates?.length > 0) {
        return (
            <Select aria-label={label} className="h-7 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">{keyword.default ? t("objectDesigner.byDefault", {value: keyword.default}) : ""}</option>
                {keyword.candidates.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
        );
    }
    if (keyword?.converter === "bool") {
        return (
            <Select aria-label={label} className="h-7 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
                <option value="">{keyword.default ? t("objectDesigner.byDefault", {value: keyword.default}) : ""}</option>
                <option value="true">true</option>
                <option value="false">false</option>
            </Select>
        );
    }
    const example = !keyword?.default && !keyword?.defaultText && value === "" ? keyword?.example ?? "" : "";
    return (
        <span className="relative block">
            <Input
                aria-label={label}
                className={`h-7 w-full font-mono text-data ${example ? "pr-14" : ""}`}
                value={value}
                placeholder={keyword?.default || keyword?.defaultText || keyword?.example || ""}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (example && e.key === "ArrowRight") {
                        e.preventDefault();
                        onChange(example);
                    }
                }}
                spellCheck={false}
                list={suggestions.length > 0 ? listId : undefined}
            />
            {example && (
                <button
                    type="button"
                    aria-label={t("objectDesigner.useExample", {value: example})}
                    title={t("objectDesigner.useExampleHint")}
                    onClick={() => onChange(example)}
                    className="absolute top-1/2 right-1 -translate-y-1/2 rounded-(--radius-control) border border-line px-1.5 text-data text-ink-muted hover:border-accent hover:text-accent"
                >
                    {t("objectDesigner.use")}
                </button>
            )}
            {suggestions.length > 0 && (
                <datalist id={listId}>
                    {suggestions.map((name) => <option key={name} value={name}/>)}
                </datalist>
            )}
        </span>
    );
}

/** What a keyword does, in the pane: its text and its facts, the grant it needs said. */
function KeywordHelp({keyword}) {
    return (
        <div className="space-y-1 rounded-(--radius-control) border border-line bg-surface-sunken p-2 text-ui">
            {keyword.text && <p className="whitespace-pre-line">{keyword.text.trim()}</p>}
            {keyword.grantDoc && <p className="text-state-warn">{keyword.grantDoc}</p>}
            <KeywordFacts keyword={keyword}/>
        </div>
    );
}

/** The keywords of a section to add: filtered by words, each its first line, its doc on demand. */
function KeywordPicker({keywords, onAdd}) {
    const {t} = useTranslation();
    const ids = useId();
    const [words, setWords] = useState("");
    const [open, setOpen] = useState(null);
    // The line the arrows move over, Enter adding it: the first matching as the words change.
    const [active, setActive] = useState(0);
    const listRef = useRef(null);
    const matching = keywords.filter((k) => `${k.option} ${k.text ?? ""}`.toLowerCase().includes(words.toLowerCase()));
    const current = Math.min(active, matching.length - 1);
    useEffect(() => {
        listRef.current?.querySelector("[data-active]")?.scrollIntoView?.({block: "nearest"});
    }, [current]);
    const onKeyDown = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (matching.length > 0) setActive((current + (e.key === "ArrowDown" ? 1 : matching.length - 1)) % matching.length);
        } else if (e.key === "Enter" && matching[current]) {
            e.preventDefault();
            onAdd(matching[current]);
        }
    };
    return (
        <div className="space-y-2 rounded-(--radius-control) border border-line p-2">
            <label className="relative flex items-center">
                <SearchIcon className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-ink-muted"/>
                <Input
                    type="search"
                    aria-label={t("objectDesigner.findKeyword")}
                    placeholder={t("objectDesigner.findKeyword")}
                    className="h-7 w-full pl-7"
                    value={words}
                    onChange={(e) => {
                        setWords(e.target.value);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    aria-controls={`${ids}-keywords`}
                    aria-activedescendant={matching[current] ? `${ids}-kw-${matching[current].option}` : undefined}
                    autoFocus
                />
            </label>
            <ul ref={listRef} id={`${ids}-keywords`} aria-label={t("objectDesigner.keywords")} className="max-h-64 space-y-0.5 overflow-auto">
                {matching.length === 0 && <li className="text-ink-muted">{t("objectDesigner.noKeyword")}</li>}
                {matching.map((k, i) => (
                    <li key={k.option} id={`${ids}-kw-${k.option}`} data-keyword={k.option} data-active={i === current ? "" : undefined} className="space-y-1">
                        <div className="flex items-center gap-2">
                            {/* The line a click adding it; its doc by the button at its end. */}
                            <button
                                type="button"
                                onClick={() => onAdd(k)}
                                aria-label={t("objectDesigner.addKeyword", {keyword: k.option})}
                                className={`min-w-0 flex-1 truncate rounded-(--radius-control) px-1.5 py-0.5 text-left hover:bg-accent-soft hover:text-accent ${i === current ? "bg-accent-soft" : ""}`}
                            >
                                <span className="font-mono">{k.option}</span>
                                {/* The grant it needs: for any value, or for some only (a uri of the server, of an install). */}
                                {k.grant && (
                                    <span className="ml-1.5 text-data text-state-warn" title={k.grantDoc || undefined}>
                                        {k.grantAlways === false ? t("objectDesigner.grantSome", {grant: k.grant}) : k.grant}
                                    </span>
                                )}
                                <span className="ml-2 text-data text-ink-muted">{firstLine(k.text)}</span>
                            </button>
                            <IconButton
                                size="sm"
                                label={t("objectDesigner.readDoc", {keyword: k.option})}
                                aria-expanded={open === k.option}
                                onClick={() => setOpen(open === k.option ? null : k.option)}
                            >
                                <InfoIcon className="h-3 w-3"/>
                            </IconButton>
                        </div>
                        {open === k.option && <KeywordHelp keyword={k}/>}
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * A resource added: its driver group, a card each, then its type, a click adding it,
 * from the drivers of its kind
 * the node of the api has (its capabilities); unread, the driver typed (`fs.flag`),
 * checked by reading its keywords.
 */
function AddResource({kind, keywordsUrl, onAdd, onCancel}) {
    const {t} = useTranslation();
    const [drivers, setDrivers] = useState(null);
    const [group, setGroup] = useState("");
    const [typed, setTyped] = useState("");
    const [error, setError] = useState(null);
    const [checking, setChecking] = useState(false);
    useEffect(() => {
        let live = true;
        readDrivers(kind).then((items) => live && setDrivers(items), () => live && setDrivers([]));
        return () => {
            live = false;
        };
    }, [kind]);
    const groups = [...new Set((drivers ?? []).map((d) => d.group))].sort();
    const types = (drivers ?? []).filter((d) => d.group === group);
    const add = async (driver) => {
        setChecking(true);
        setError(null);
        try {
            const keywords = await driverKeywords(keywordsUrl, driver);
            onAdd(parseDriver(driver), keywords);
        } catch (err) {
            setError(t("objectDesigner.unknownDriver", {driver, message: err.message}));
        } finally {
            setChecking(false);
        }
    };
    if (drivers === null) return <Spinner label={t("objectDesigner.reading")}/>;
    return (
        <div className="space-y-2" data-add-resource="">
            {drivers.length > 0 ? (
                <>
                    {/* The groups, a card each with its part in the app; a type then, a click adding it. */}
                    <div role="group" aria-label={t("objectDesigner.groups")} className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-1.5 p-0.5">
                        {groups.map((g) => (
                            <button
                                key={g}
                                type="button"
                                data-group={g}
                                aria-pressed={group === g}
                                disabled={checking}
                                onClick={() => (NEEDS_GROUPS.includes(g) ? add(g) : setGroup(g))}
                                className="flex min-w-0 flex-col items-start gap-0.5 rounded-(--radius-panel) border border-line bg-surface-raised p-2 text-left hover:border-line-strong aria-pressed:border-accent aria-pressed:bg-accent-soft"
                            >
                                <span className="font-mono font-medium">{g}</span>
                                <span className="text-data text-ink-muted">{t(`objectDesigner.groupRoles.${g}`, {defaultValue: ""})}</span>
                            </button>
                        ))}
                    </div>
                    {group && (
                        <ul aria-label={t("objectDesigner.types")} className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1.5 overflow-auto p-0.5">
                            {types.map((d) => (
                                <li key={d.name}>
                                    <button
                                        type="button"
                                        disabled={checking}
                                        onClick={() => add(d.name)}
                                        className="w-full rounded-(--radius-control) border border-line px-2 py-1 text-left hover:border-accent hover:bg-accent-soft"
                                    >
                                        <span className="font-mono">{d.type}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            ) : (
                <Input
                    aria-label={t("objectDesigner.driver")}
                    placeholder="fs.flag"
                    className="h-8 w-full max-w-xs font-mono"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    spellCheck={false}
                />
            )}
            {error && <p role="alert" className="text-data text-state-down">{error}</p>}
            <div className="flex gap-2">
                <Button size="sm" onClick={onCancel}>{t("common.cancel")}</Button>
                {/* The driver typed, the drivers unread: added by the button. */}
                {drivers.length === 0 && (
                    <Button
                        size="sm"
                        variant="create"
                        disabled={checking || !(/^[a-z0-9_]+\.[a-z0-9_.]+$/i.test(typed.trim()) || NEEDS_GROUPS.includes(typed.trim()))}
                        onClick={() => add(typed.trim())}
                    >
                        {t("objectDesigner.addResource")}
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * The design of the configuration of an object of `kind`: `sections` and their
 * change; `keywordsUrl`, the keywords address of the object made. Root picks
 * whether to see the keywords only root may set, when the daemon says which. A
 * kind taking no resource, a user, has none to add. `onToText`, its file edited as a
 * text from then on. `showRoot` and `onShowRoot`, root's choice held by the caller,
 * its checkbox where the caller puts it. `namespace`, the one of the object, whose
 * claims say the networks offered to who is not root.
 */
export function ObjectDesigner({kind, namespace = "", sections, onChange, keywordsUrl, isRoot = false, onToText, showRoot: shownRoot, onShowRoot}) {
    const {t} = useTranslation();
    const ids = useId();
    const [selected, setSelected] = useState(sections[0]?.name ?? "DEFAULT");
    // The keywords read, by driver: DEFAULT at once, a resource's when added.
    const [keywords, setKeywords] = useState({});
    const [error, setError] = useState(null);
    const [adding, setAdding] = useState(false);
    const [picking, setPicking] = useState(false);
    const [help, setHelp] = useState(null);
    // Never the keywords only root may set whatever the value, to another user; to root, when it asks.
    const [ownShowRoot, setOwnShowRoot] = useState(false);
    const showRoot = onShowRoot ? shownRoot : ownShowRoot;
    const hideRoot = !(isRoot && showRoot);
    const [preview, setPreview] = useState(false);
    // The types of pool a volume may need, read once there is a volume.
    const [pools, setPools] = useState([]);
    const needs = sections.some((s) => NEEDS_GROUPS.includes(s.group));
    useEffect(() => {
        if (!needs) return undefined;
        let live = true;
        readCapabilities().then((names) => live && setPools(poolTypes(names)), () => {});
        return () => {
            live = false;
        };
    }, [needs]);
    // The networks of the cluster, read once a section draws its address from one.
    const [networks, setNetworks] = useState([]);
    const drawsAddress = sections.some((s) => NETWORK_DRIVERS.includes(`${s.group}.${s.type}`));
    useEffect(() => {
        if (!drawsAddress) return undefined;
        let live = true;
        readNetworks(namespace, isRoot).then((names) => live && setNetworks(names));
        return () => {
            live = false;
        };
    }, [drawsAddress, namespace, isRoot]);

    useEffect(() => {
        let live = true;
        driverKeywords(keywordsUrl, "DEFAULT").then(
            (items) => live && setKeywords((k) => ({...k, DEFAULT: items})),
            (err) => live && setError(err.message),
        );
        // The drivers of the resources there, read again for a design brought back; a
        // resource of the type of its group by default, by its section in the object.
        for (const s of sections) {
            if (!s.group) continue;
            const driver = `${s.group}.${s.type}`;
            const read = s.type ? driverKeywords(keywordsUrl, driver) : readJson(`${keywordsUrl}?section=${encodeURIComponent(s.name)}`).then((d) => d?.items ?? []);
            read.then((items) => live && setKeywords((k) => ({...k, [driver]: items})), () => {});
        }
        return () => {
            live = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keywordsUrl]);

    // The keywords a section requires, there as soon as its driver's are read: a section
    // added, or brought back from a file without them.
    useEffect(() => {
        let changed = false;
        const next = sections.map((s) => {
            const items = keywords[s.group ? `${s.group}.${s.type}` : "DEFAULT"];
            if (!items || FREE_SECTIONS.includes(s.name)) return s;
            const done = withRequired(items, s);
            if (done.entries.length === s.entries.length) return s;
            changed = true;
            return done;
        });
        if (changed) onChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keywords, sections]);

    const section = sections.find((s) => s.name === selected) ?? sections[0];
    const driverOf = (s) => (s.group ? `${s.group}.${s.type}` : "DEFAULT");
    const known = keywords[driverOf(section)] ?? [];
    const free = FREE_SECTIONS.includes(section.name);
    const allKeywords = useMemo(() => Object.values(keywords).flat(), [keywords]);
    const missing = missingValues(sections, allKeywords);
    const required = new Set(free ? [] : requiredKeywords(known, section).map((k) => k.option));
    const keywordOf = (key) => sectionKeywords(known, section).find((k) => k.option === key);
    // Its required keywords set, the ones most set offered at once.
    const popular = free || missing.some((m) => m.section === section.name) ? [] : popularKeywords(known, section, hideRoot);
    // Whether the daemon says which keywords need a grant: else, no choice to offer.
    const grantsTold = allKeywords.some((k) => k.grant !== undefined);

    const update = (next) => onChange(sections.map((s) => (s.name === section.name ? next : s)));
    const setEntry = (i, patch) => update({...section, entries: section.entries.map((e, j) => (j === i ? {...e, ...patch} : e))});
    const removeEntry = (i) => update({...section, entries: section.entries.filter((_, j) => j !== i)});
    const addEntry = (key) => update({...section, entries: [...section.entries, {key, value: ""}]});
    const addResource = ({group, type}, items) => {
        const driver = `${group}.${type}`;
        setKeywords((k) => ({...k, [driver]: items}));
        const name = nextSectionName(sections, group);
        onChange([...sections, withRequired(items, {name, group, type, entries: []})]);
        setSelected(name);
        setAdding(false);
        setPicking(false);
    };
    const removeSection = (name) => {
        onChange(sections.filter((s) => s.name !== name));
        if (selected === name) setSelected("DEFAULT");
    };

    return (
        <div className="space-y-3" data-designer="">
            {error && <p role="alert" className="text-state-down">{t("objectDesigner.readFailed", {message: error})}</p>}
            {isRoot && grantsTold && !onShowRoot && (
                <Checkbox
                    label={t("objectDesigner.showRoot")}
                    checked={showRoot}
                    onChange={(e) => setOwnShowRoot(e.target.checked)}
                />
            )}
            <div className="grid min-h-[20rem] gap-3 sm:grid-cols-[13rem_1fr]">
                {/* The sections: DEFAULT and env, then the resources, a + to add one. */}
                <nav aria-label={t("objectDesigner.sections")} className="space-y-2">
                    <ul className="space-y-0.5">
                        {sections.map((s) => {
                            const incomplete = missing.some((m) => m.section === s.name);
                            return (
                                <li key={s.name} className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-current={!adding && s.name === section.name ? "true" : undefined}
                                        onClick={() => {
                                            setSelected(s.name);
                                            setPicking(false);
                                            setAdding(false);
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-(--radius-control) border border-transparent px-2 py-1 text-left hover:bg-surface-sunken aria-[current]:border-accent aria-[current]:bg-accent-soft"
                                    >
                                        <span className="truncate font-mono">{s.name}</span>
                                        {s.type && <span className="truncate text-data text-ink-muted">{s.type}</span>}
                                        {incomplete && <span className="ml-auto text-state-warn" title={t("objectDesigner.incomplete")} aria-label={t("objectDesigner.incomplete")}>•</span>}
                                    </button>
                                    {s.group && (
                                        <IconButton size="sm" label={t("objectDesigner.removeSection", {section: s.name})} onClick={() => removeSection(s.name)}>
                                            <CloseIcon className="h-3 w-3"/>
                                        </IconButton>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {takesResources(kind) && (
                        <button
                            type="button"
                            aria-pressed={adding}
                            onClick={() => {
                                setAdding(true);
                                setPicking(false);
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-(--radius-control) border border-dashed border-line px-2 py-1 text-ink-muted hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:text-accent"
                        >
                            <PlusIcon className="h-3.5 w-3.5"/>
                            {t("objectDesigner.addResource")}
                        </button>
                    )}
                </nav>

                {/* A resource added, its driver picked; else the keys of the section picked. */}
                {adding ? (
                    <section aria-labelledby={`${ids}-adding`} className="min-w-0 space-y-2">
                        <h3 id={`${ids}-adding`} className="sr-only">{t("objectDesigner.addResource")}</h3>
                        <AddResource kind={kind} keywordsUrl={keywordsUrl} onAdd={addResource} onCancel={() => setAdding(false)}/>
                    </section>
                ) : (
                    <section aria-labelledby={`${ids}-section`} className="min-w-0 space-y-2">
                        <h3 id={`${ids}-section`} className="sr-only">
                            <span className="font-mono">[{section.name}]</span>
                            {section.type && <span>{` ${section.group}.${section.type}`}</span>}
                        </h3>
                        {free && <p className="text-data text-ink-muted">{t("objectDesigner.envHint")}</p>}
                        {section.entries.length === 0 && !free && <p className="text-data text-ink-muted">{t("objectDesigner.noEntry")}</p>}
                        <ul aria-label={t("objectDesigner.entries", {section: section.name})} className="space-y-1">
                            {section.entries.map((entry, i) => {
                                const keyword = free ? undefined : keywordOf(entry.key);
                                const isRequired = required.has(entry.key);
                                const empty = isRequired && entry.value.trim() === "";
                                return (
                                    <li key={i} data-entry={entry.key} className="space-y-1">
                                        <div className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-2">
                                            {free ? (
                                                <Input
                                                    aria-label={t("objectDesigner.variable")}
                                                    className="h-7 font-mono text-data"
                                                    value={entry.key}
                                                    onChange={(e) => setEntry(i, {key: e.target.value})}
                                                    spellCheck={false}
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setHelp(help === `${section.name}.${entry.key}` ? null : `${section.name}.${entry.key}`)}
                                                    className={`truncate text-left font-mono text-data hover:text-accent ${empty ? "text-state-warn" : ""}`}
                                                    title={t("objectDesigner.readDoc", {keyword: entry.key})}
                                                >
                                                    {entry.key}{isRequired && <span aria-label={t("objectDesigner.required")}> *</span>}
                                                </button>
                                            )}
                                            <ValueInput
                                                keyword={keyword}
                                                value={entry.value}
                                                onChange={(value) => setEntry(i, {value})}
                                                label={t("objectDesigner.valueOf", {keyword: entry.key || t("objectDesigner.variable")})}
                                            suggestions={
                                                entry.key === "network" && NETWORK_DRIVERS.includes(`${section.group}.${section.type}`) ? networks
                                                    : entry.key === "type" && NEEDS_GROUPS.includes(section.group) ? pools
                                                        : []
                                            }
                                            />
                                            {isRequired ? <span className="w-5"/> : (
                                                <IconButton size="sm" label={t("objectDesigner.removeEntry", {keyword: entry.key})} onClick={() => removeEntry(i)}>
                                                    <CloseIcon className="h-3 w-3"/>
                                                </IconButton>
                                            )}
                                        </div>
                                        {keyword && help === `${section.name}.${entry.key}` && <KeywordHelp keyword={keyword}/>}
                                    </li>
                                );
                            })}
                        </ul>
                        {free ? (
                            <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5"/>} onClick={() => addEntry("")}>{t("objectDesigner.addVariable")}</Button>
                        ) : picking ? (
                            <KeywordPicker
                                keywords={offeredKeywords(known, section, hideRoot)}
                                onAdd={(k) => {
                                    addEntry(k.option);
                                    setPicking(false);
                                }}
                            />
                        ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Button size="sm" icon={<PlusIcon className="h-3.5 w-3.5"/>} onClick={() => setPicking(true)} disabled={known.length === 0}>
                                    {t("objectDesigner.moreKeyword")}
                                </Button>
                                {/* The ones most set, a click each. */}
                                {popular.map((k) => (
                                    <button
                                        key={k.option}
                                        type="button"
                                        data-popular={k.option}
                                        aria-label={t("objectDesigner.addKeyword", {keyword: k.option})}
                                        title={firstLine(k.text ?? "")}
                                        onClick={() => addEntry(k.option)}
                                        className="inline-flex h-7 items-center gap-1 rounded-(--radius-control) border border-dashed border-line px-2 font-mono text-data text-ink-muted hover:border-accent hover:text-accent"
                                    >
                                        <PlusIcon className="h-3 w-3"/>
                                        {k.option}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
            {missing.length > 0 && (
                <p className="text-data text-state-warn">{t("objectDesigner.missing", {keys: missing.map((m) => `${m.section}.${m.key}`).join(", ")})}</p>
            )}
            {/* The file it makes, on demand; or edited as a text from then on. */}
            <div>
                <span className="flex flex-wrap gap-2">
                    <Button size="sm" aria-expanded={preview} onClick={() => setPreview((p) => !p)}>{t(preview ? "objectDesigner.hideFile" : "objectDesigner.showFile")}</Button>
                    {onToText && <Button size="sm" onClick={onToText}>{t("createObject.designToText")}</Button>}
                </span>
                {preview && (
                    <pre data-preview="" className="mt-2 max-h-64 overflow-auto rounded-(--radius-control) border border-line bg-surface-sunken p-2 font-mono text-data">
                        {designText(sections) || t("objectDesigner.emptyFile")}
                    </pre>
                )}
            </div>
        </div>
    );
}
