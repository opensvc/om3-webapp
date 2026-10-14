import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {getResponseErrorMessage} from "../services/api.jsx";

/*
 * A configuration file as stored, each keyword it sets documented in place: on
 * hovering its line, a "?" shows what the keyword does, as `om <path> config doc`
 * tells it. In the place of a dialog listing every keyword of the kind.
 */

/** The keywords read, by what they document (a kind, the node): read once a session. */
const keywordsCache = new Map();

function loadKeywords(cacheKey, url) {
    if (!keywordsCache.has(cacheKey)) {
        const promise = fetch(url, {
            headers: {Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`},
        }).then(async (response) => {
            if (!response.ok) throw new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
            const data = await response.json();
            return Array.isArray(data?.items) ? data.items : [];
        });
        // A read that failed is tried again the next time.
        promise.catch(() => keywordsCache.delete(cacheKey));
        keywordsCache.set(cacheKey, promise);
    }
    return keywordsCache.get(cacheKey);
}

/** Forgets the keywords read, for the tests. */
export const clearKeywordsCache = () => keywordsCache.clear();

const SECTION = /^\s*\[([^\]]+)\]\s*$/;
// A key at the start of its line, not a comment nor the continuation of a value.
const KEY = /^([^\s#;=[][^=]*?)\s*=/;

/**
 * The lines of the file, each key line with its section, its key without the
 * scope (`nodes@n1` is `nodes`), and the type its section declares, which selects
 * the keywords of a driver.
 */
export function parseConfig(text) {
    const lines = text.split("\n");
    const types = {};
    let section = "DEFAULT";
    for (const line of lines) {
        const s = line.match(SECTION);
        if (s) section = s[1].trim();
        const k = !s && line.match(KEY);
        if (k && k[1].trim() === "type") types[section] = line.slice(line.indexOf("=") + 1).trim();
    }
    section = "DEFAULT";
    return lines.map((line) => {
        const s = line.match(SECTION);
        if (s) {
            section = s[1].trim();
            return {line};
        }
        const k = line.match(KEY);
        if (!k) return {line};
        return {line, section, key: k[1].trim().split("@")[0], type: types[section]};
    });
}

/**
 * The keyword a key of a section sets: of the kind of the section (`fs` for
 * `fs#1`), else of any section (`comment`), the one of the type of the section
 * when the keyword differs by driver.
 */
export function findKeyword(keywords, {section, key, type}) {
    const kind = section === "DEFAULT" ? "DEFAULT" : section.split("#")[0];
    const named = (k) => k.option === key || (k.aliases ?? []).includes(key);
    const ofSection = keywords.filter((k) => named(k) && (k.section === kind || (kind === "DEFAULT" && k.section === "")));
    const candidates = ofSection.length > 0 ? ofSection : keywords.filter((k) => named(k) && k.section === "");
    if (candidates.length === 0) return null;
    return candidates.find((k) => type && (k.types ?? []).includes(type))
        ?? candidates.find((k) => (k.types ?? []).length === 0)
        ?? candidates[0];
}

/** What a keyword does, as its documentation says it. */
function KeywordDoc({keyword, label, onClose}) {
    const {t} = useTranslation();
    const facts = [
        ["default", keyword.default || keyword.defaultText],
        ["candidates", (keyword.candidates ?? []).join(", ")],
        ["example", keyword.example],
        ["converter", keyword.converter],
        ["scopable", keyword.scopable ? t("common.yes") : ""],
        ["deprecated", keyword.deprecated && (keyword.replacedBy ? t("config.keywordHelp.replacedBy", {keyword: keyword.replacedBy}) : keyword.deprecated)],
    ].filter(([, value]) => value);
    return (
        <div
            role="dialog"
            aria-label={label}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation();
                    onClose();
                }
            }}
            className="absolute top-full right-0 z-20 mt-1 w-[min(36rem,90vw)] space-y-2 rounded-(--radius-panel) border border-line bg-surface-raised p-3 font-sans text-ui whitespace-normal text-ink shadow-lg"
        >
            <p className="font-mono font-semibold">{label}</p>
            {keyword.text && <p className="whitespace-pre-line">{keyword.text.trim()}</p>}
            {facts.length > 0 && (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5">
                    {facts.map(([fact, value]) => (
                        <React.Fragment key={fact}>
                            <dt className="text-ink-muted">{t(`config.keywordHelp.${fact}`)}</dt>
                            <dd className="font-mono text-data break-all">{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            )}
        </div>
    );
}

/**
 * The file, a "?" by each keyword set, shown on hovering its line or reaching it
 * from the keyboard. The keywords are read the first time the file is hovered or
 * focused: the help of every key then stands ready.
 */
export function ConfigText({text, keywordsUrl, cacheKey = keywordsUrl, label}) {
    const {t} = useTranslation();
    const lines = useMemo(() => parseConfig(text), [text]);
    const [keywords, setKeywords] = useState(null);
    const [error, setError] = useState(null);
    const [open, setOpen] = useState(null);
    const root = useRef(null);

    const load = useCallback(() => {
        if (keywords !== null || !keywordsUrl) return;
        loadKeywords(cacheKey, keywordsUrl).then(setKeywords, (err) => setError(err.message));
    }, [keywords, keywordsUrl, cacheKey]);

    // A click beside the help closes it.
    useEffect(() => {
        if (open === null) return undefined;
        const onPointerDown = (event) => {
            if (!root.current?.querySelector(`[data-line="${open}"]`)?.contains(event.target)) setOpen(null);
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open]);

    return (
        <div
            ref={root}
            onMouseEnter={load}
            onFocus={load}
            className="overflow-x-auto rounded-(--radius-control) border border-line bg-surface-sunken p-2"
        >
            {error && <p className="mb-1 text-data text-ink-muted">{t("config.keywordHelp.loadError", {message: error})}</p>}
            <div role="group" aria-label={label} tabIndex={0} className="font-mono text-data whitespace-pre-wrap text-ink">
                {lines.map((l, index) => {
                    const keyword = l.key && keywords ? findKeyword(keywords, l) : null;
                    const name = keyword && `${l.section === "DEFAULT" ? "" : `${l.section}.`}${l.key}`;
                    return (
                        <div key={index} data-line={index} className="group relative flex min-h-[1lh] items-start gap-2 hover:bg-surface">
                            <span className="min-w-0 flex-1">{l.line}</span>
                            {keyword && (
                                <button
                                    type="button"
                                    aria-label={t("config.keywordHelp.open", {keyword: name})}
                                    aria-expanded={open === index}
                                    title={t("config.keywordHelp.open", {keyword: name})}
                                    onClick={() => setOpen(open === index ? null : index)}
                                    className={`h-4 w-4 shrink-0 rounded-full border border-line bg-surface-raised text-[0.7rem] leading-none font-semibold text-ink-muted hover:text-ink focus:opacity-100 ${open === index ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                >
                                    ?
                                </button>
                            )}
                            {open === index && keyword && (
                                <KeywordDoc keyword={keyword} label={name} onClose={() => setOpen(null)}/>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
