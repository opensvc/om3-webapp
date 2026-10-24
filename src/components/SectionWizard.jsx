import React, {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {trackRefused, trackWrite} from "../app/action-tracker";
import {opsQuery} from "../app/namespace-claims";
import {
    SECTION_NAME,
    editOps,
    editPreview,
    firstParagraph,
    missingFields,
    sectionFields,
    sectionOps,
    sectionPreview,
    sectionTypes,
    typeDescriptions,
} from "../app/section-config";
import {refusalReason} from "./objectActions";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {Checkbox, Field, Input, Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";

const KEYWORDS_URL = `${URL_CLUSTER}/config/keywords`;

const headers = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

const STEPS = ["type", "settings", "review"];

const noChecks = () => ({errors: {}, warnings: []});

/**
 * The wizard of a typed section of the cluster configuration, `[<section>#<name>]`, a
 * network or a pool, root only: its name and type, the keys of its type as the daemon
 * declares them, the section as it will be written, written to the cluster
 * configuration, which the daemons apply.
 *
 * `section`, the section; `rules`, what it asks beyond its keywords (`SectionRules`);
 * `prefix`, the keys of its texts. `items`, the sections there are, their names taken;
 * `nodes`, the nodes of the cluster, a value each for the keys of a type taken on each
 * node apart. `validate(values, others)`, its own checks of the values, those of the
 * other sections given: `{errors: {key: text}, warnings: [text]}`, an error holding the
 * wizard back. `edit`, a section to modify, `{name, values}`: the wizard seeded with
 * it, its name kept, what changed written; none, a new one, written whole in one write.
 */
export function SectionWizard({section, rules, prefix, items, nodes, edit, validate = noChecks, onClose, onSaved}) {
    const {t} = useTranslation();
    const p = (key, options) => t(`${prefix}.${key}`, options);
    const [keywords, setKeywords] = useState(null);
    const [error, setError] = useState(null);
    const original = edit?.values ?? {};
    const [name, setName] = useState(edit?.name ?? "");
    const [type, setType] = useState(original.type || null);
    const [values, setValues] = useState(() => Object.fromEntries(Object.entries(original).filter(([key]) => key !== "type")));
    const [step, setStep] = useState("type");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let live = true;
        fetch(KEYWORDS_URL, {headers: headers()})
            .then(async (response) => {
                if (!response.ok) throw new Error((await getResponseErrorMessage(response)) || `HTTP ${response.status}`);
                return response.json();
            })
            .then((data) => {
                if (!live) return;
                const list = data.items ?? [];
                setKeywords(list);
                // The default of the daemon, or the one type there is.
                const {types: all, default: first} = sectionTypes(list, section);
                setType((current) => current ?? first ?? (all.length === 1 ? all[0] : null));
            }, (err) => live && setError(err.message));
        return () => {
            live = false;
        };
    }, [section]);

    const {types} = useMemo(() => sectionTypes(keywords ?? [], section), [keywords, section]);
    const descriptions = useMemo(() => typeDescriptions(keywords ?? [], section), [keywords, section]);
    const fields = useMemo(() => (type ? sectionFields(keywords ?? [], section, type, rules) : []), [keywords, section, type, rules]);
    const fieldKeys = new Set(fields.map((f) => f.key));
    // The values of the type chosen: those typed for another type kept aside, not written.
    const own = Object.fromEntries(Object.entries(values).filter(([key]) => fieldKeys.has(key.split("@")[0])));

    const trimmedName = name.trim();
    // A section modified keeps its name: nothing to check of it.
    const nameError = edit || trimmedName === "" ? null
        : !SECTION_NAME.test(trimmedName) ? p("nameInvalid")
            : items.some((n) => n.name === trimmedName) ? p("nameTaken", {name: trimmedName})
                : null;
    const others = items.filter((n) => n.name !== trimmedName);
    const checks = validate(own, others);
    const missing = missingFields(fields, own, nodes);
    const keys = fields.map((f) => f.key);
    const changes = edit && type ? editOps(section, trimmedName, type, original, values, keys) : null;
    const unchanged = changes !== null && !changes.rewrite && changes.set.length === 0 && changes.unset.length === 0;

    const canNext = step === "type"
        ? trimmedName !== "" && !nameError && Boolean(type)
        : step === "settings" ? missing.length === 0 && Object.keys(checks.errors).length === 0 : false;
    const index = STEPS.indexOf(step);
    const set = (key, value) => setValues((prev) => ({...prev, [key]: value}));

    const save = async () => {
        const write = {action: "config", label: p(edit ? "trayEdit" : "tray", {name: trimmedName}), subject: trimmedName};
        setSaving(true);
        setError(null);
        try {
            const patch = (query) => fetch(`${URL_CLUSTER}/config?${query}`, {method: "PATCH", headers: headers()});
            let response;
            if (changes) {
                // Another type: the section of the former gone first, its keys meaning nothing to the new one.
                if (changes.rewrite) {
                    response = await patch(opsQuery({delete: [`${section}#${trimmedName}`]}));
                }
                if (!response || response.ok) response = await patch(opsQuery({set: changes.set, unset: changes.unset}));
            } else {
                response = await patch(opsQuery({set: sectionOps(section, trimmedName, type, own)}));
            }
            const ok = await trackWrite(response, write, async (r) => {
                const detail = await getResponseErrorMessage(r);
                setError(detail || `HTTP ${r.status}`);
                return refusalReason({status: r.status, detail});
            });
            if (ok) onSaved(trimmedName);
            else setSaving(false);
        } catch (err) {
            trackRefused({...write, reason: err.message});
            setError(err.message);
            setSaving(false);
        }
    };

    /** The control of a field, `key` its key, scoped or not: its keyword says which. */
    const control = (one, key, props) => {
        const keyword = one.keyword;
        const value = values[key] ?? "";
        if (one.kind === "choice") {
            return (
                <Select {...props} value={value} onChange={(event) => set(key, event.target.value)}>
                    <option value="">{keyword.default ? p("byDefault", {value: keyword.default}) : p("unset")}</option>
                    {keyword.candidates.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
            );
        }
        if (one.kind === "choices") {
            const chosen = value.split(/\s+/).filter(Boolean);
            const toggle = (c, on) => set(key, keyword.candidates.filter((x) => (x === c ? on : chosen.includes(x))).join(" "));
            return (
                <div className="flex flex-wrap gap-x-4 gap-y-1" role="group" aria-labelledby={props.id}>
                    {keyword.candidates.map((c) => (
                        <Checkbox key={c} label={c} checked={chosen.includes(c)} onChange={(event) => toggle(c, event.target.checked)}/>
                    ))}
                </div>
            );
        }
        return (
            <Input
                {...props}
                inputMode={one.kind === "number" ? "numeric" : undefined}
                value={value}
                placeholder={String(keyword.default || keyword.example || "")}
                onChange={(event) => set(key, event.target.value)}
                autoComplete="off"
                spellCheck={false}
            />
        );
    };

    /** A field: its keyword's help under it, a list said space separated, its error under it. */
    const field = (one, key, label) => {
        if (one.kind === "bool") {
            return (
                <div key={key}>
                    <Checkbox label={label} checked={values[key] === "true"} onChange={(event) => set(key, event.target.checked ? "true" : "")}/>
                    {one.keyword.text && <p className="mt-1 text-data text-ink-muted">{firstParagraph(one.keyword.text)}</p>}
                </div>
            );
        }
        const hint = [firstParagraph(one.keyword.text), one.kind === "list" || one.kind === "choices" ? p("listHint") : ""]
            .filter(Boolean).join(" ");
        return (
            <Field key={key} label={label} hint={hint || undefined} error={checks.errors[key] || undefined}>
                {(props) => control(one, key, props)}
            </Field>
        );
    };
    const labelOf = (one) => (one.required ? p("required", {key: one.key}) : one.key);
    const warnings = checks.warnings.map((text) => <Alert key={text} tone="warning">{text}</Alert>);

    return (
        <Dialog
            open
            size="md"
            title={edit ? p("editTitle", {name: trimmedName}) : p("title", {name: trimmedName || "…"})}
            onClose={onClose}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                    {index > 0 && <Button variant="secondary" onClick={() => setStep(STEPS[index - 1])} disabled={saving}>{p("back")}</Button>}
                    {step === "review" ? (
                        <Button variant={edit ? "change" : "create"} onClick={save} disabled={saving || unchanged}>
                            {saving ? p("saving") : p(edit ? "update" : "save")}
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={() => setStep(STEPS[index + 1])} disabled={!canNext}>{p("next")}</Button>
                    )}
                </>
            )}
        >
            {keywords === null && !error && <Spinner/>}
            {keywords === null && error && <Alert tone="error">{p("readFailed", {message: error})}</Alert>}
            {keywords !== null && (
                <div className="space-y-4">
                    <ol aria-label={p("steps")} className="flex flex-wrap gap-x-3 gap-y-1 text-data">
                        {STEPS.map((s, i) => (
                            <li key={s} aria-current={s === step ? "step" : undefined} className={s === step ? "font-semibold text-ink" : "text-ink-muted"}>
                                {`${i + 1}. ${p(`step.${s}`)}`}
                            </li>
                        ))}
                    </ol>

                    {step === "type" && (
                        <div className="space-y-4">
                            <Field label={p("name")} hint={edit ? p("nameKept") : p("nameHint")} error={nameError || undefined}>
                                {(props) => (
                                    <Input {...props} value={name} onChange={(event) => setName(event.target.value)} readOnly={Boolean(edit)}
                                           autoComplete="off" spellCheck={false} autoFocus={!edit}/>
                                )}
                            </Field>
                            <fieldset className="space-y-2">
                                <legend className="mb-1 font-medium">{p("typeQuestion")}</legend>
                                {types.map((kind) => (
                                    <label key={kind} className="flex cursor-pointer items-start gap-2 rounded-(--radius-control) border border-line p-2 hover:bg-surface-sunken">
                                        <input type="radio" name={`${section}-type`} value={kind} checked={type === kind} onChange={() => setType(kind)} className="mt-1"/>
                                        <span>
                                            <span className="block font-medium">{kind}</span>
                                            {descriptions[kind] && <span className="block text-data text-ink-muted">{descriptions[kind]}</span>}
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                        </div>
                    )}

                    {step === "settings" && (
                        <div className="space-y-4" data-step="settings">
                            {fields.map((one) => (one.perNode ? (
                                // A value a node: one for all would not do.
                                <fieldset key={one.key} className="space-y-2">
                                    <legend className="mb-1 font-medium">{labelOf(one)}</legend>
                                    <p className="text-data text-ink-muted">{firstParagraph(one.keyword.text)}</p>
                                    {nodes.map((node) => field({...one, keyword: {...one.keyword, text: ""}}, `${one.key}@${node}`, p("onNode", {key: one.key, node})))}
                                </fieldset>
                            ) : field(one, one.key, labelOf(one))))}
                            {warnings}
                        </div>
                    )}

                    {step === "review" && (
                        <div className="space-y-3">
                            {changes?.rewrite && <Alert tone="warning">{p("rewrite", {from: original.type, to: type})}</Alert>}
                            <div>
                                <p className="mb-1 text-data text-ink-muted">{p("written")}</p>
                                <pre data-testid={`${section}-preview`} className="rounded-(--radius-control) border border-line bg-surface-sunken p-2 font-mono text-data">
                                    {edit ? editPreview(section, trimmedName, type, original, values, keys) : sectionPreview(section, trimmedName, type, own)}
                                </pre>
                            </div>
                            {unchanged && <p className="text-ink-muted">{p("unchanged")}</p>}
                            {warnings}
                            {error && <Alert tone="error">{p("saveFailed", {message: error})}</Alert>}
                        </div>
                    )}
                </div>
            )}
        </Dialog>
    );
}
