import React, {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {URL_CLUSTER} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";
import {trackRefused, trackWrite} from "../app/action-tracker";
import {opsQuery} from "../app/namespace-claims";
import {
    NETWORK_NAME,
    firstParagraph,
    isCidr,
    missingFields,
    networkFields,
    networkEditOps,
    networkEditPreview,
    networkOps,
    networkPreview,
    networkTypes,
    overlapping,
    typeDescriptions,
} from "../app/network-config";
import {refusalReason} from "./objectActions";
import {Alert} from "../ui/components/Alert";
import {Button} from "../ui/components/Button";
import {Dialog} from "../ui/components/Dialog";
import {Checkbox, Field, Input, Select} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";

const KEYWORDS_URL = `${URL_CLUSTER}/config/keywords`;

const headers = () => ({Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`});

const STEPS = ["type", "settings", "review"];

/**
 * The wizard of a network, root only: its name and type, the keys of its type as the
 * daemon declares them, the section as it will be written, written to the cluster
 * configuration, which the daemons apply. `networks`, those there are, their names
 * taken and their ranges not to overlap; `nodes`, the nodes of the cluster, a value
 * each for the keys of a type taken on each node apart. `edit`, a network to modify,
 * `{name, values}` its section: the wizard seeded with it, its name kept, what changed
 * written (`networkEditOps`); none, a new one, written whole in one write.
 */
export function NetworkWizard({networks, nodes, edit, onClose, onSaved}) {
    const {t} = useTranslation();
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
                const items = data.items ?? [];
                setKeywords(items);
                setType((current) => current ?? networkTypes(items).default ?? null);
            }, (err) => live && setError(err.message));
        return () => {
            live = false;
        };
    }, []);

    const {types} = useMemo(() => networkTypes(keywords ?? []), [keywords]);
    const descriptions = useMemo(() => typeDescriptions(keywords ?? []), [keywords]);
    const fields = useMemo(() => (type ? networkFields(keywords ?? [], type) : []), [keywords, type]);
    const fieldKeys = new Set(fields.map((f) => f.key));
    // The values of the type chosen: those typed for another type kept aside, not written.
    const own = Object.fromEntries(Object.entries(values).filter(([key]) => fieldKeys.has(key.split("@")[0])));

    const trimmedName = name.trim();
    // A network modified keeps its name: nothing to check of it.
    const nameError = edit || trimmedName === "" ? null
        : !NETWORK_NAME.test(trimmedName) ? t("networks.wizard.nameInvalid")
            : networks.some((n) => n.name === trimmedName) ? t("networks.wizard.nameTaken", {name: trimmedName})
                : null;
    const cidr = (own.network ?? "").trim();
    const cidrError = cidr !== "" && !isCidr(cidr) ? t("networks.wizard.cidrInvalid") : null;
    const others = networks.filter((n) => n.name !== trimmedName);
    const overlaps = cidr !== "" && !cidrError ? overlapping(cidr, others) : [];
    const keys = fields.map((f) => f.key);
    const editOps = edit && type ? networkEditOps(trimmedName, type, original, values, keys) : null;
    const unchanged = editOps !== null && !editOps.rewrite && editOps.set.length === 0 && editOps.unset.length === 0;
    const missing = missingFields(fields, own, nodes);

    const canNext = step === "type"
        ? trimmedName !== "" && !nameError && Boolean(type)
        : step === "settings" ? missing.length === 0 && !cidrError : false;
    const index = STEPS.indexOf(step);
    const set = (key, value) => setValues((prev) => ({...prev, [key]: value}));

    const save = async () => {
        const write = {
            action: "config",
            label: t(edit ? "networks.wizard.trayEdit" : "networks.wizard.tray", {name: trimmedName}),
            subject: trimmedName,
        };
        setSaving(true);
        setError(null);
        try {
            const patch = (query) => fetch(`${URL_CLUSTER}/config?${query}`, {method: "PATCH", headers: headers()});
            let response;
            if (editOps) {
                // Another type: the section of the former gone first, its keys meaning nothing to the new one.
                if (editOps.rewrite) {
                    response = await patch(opsQuery({delete: [`network#${trimmedName}`]}));
                }
                if (!response || response.ok) response = await patch(opsQuery({set: editOps.set, unset: editOps.unset}));
            } else {
                response = await patch(opsQuery({set: networkOps(trimmedName, type, own)}));
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
                    <option value="">{keyword.default ? t("networks.wizard.byDefault", {value: keyword.default}) : t("networks.wizard.unset")}</option>
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

    /** A field: its keyword's help under it, a list said space separated. */
    const field = (one, key, label) => {
        if (one.kind === "bool") {
            return (
                <div key={key}>
                    <Checkbox label={label} checked={values[key] === "true"} onChange={(event) => set(key, event.target.checked ? "true" : "")}/>
                    {one.keyword.text && <p className="mt-1 text-data text-ink-muted">{firstParagraph(one.keyword.text)}</p>}
                </div>
            );
        }
        const hint = [firstParagraph(one.keyword.text), one.kind === "list" || one.kind === "choices" ? t("networks.wizard.listHint") : ""]
            .filter(Boolean).join(" ");
        const fieldError = key === "network" ? cidrError : null;
        return (
            <Field key={key} label={label} hint={hint || undefined} error={fieldError || undefined}>
                {(props) => control(one, key, props)}
            </Field>
        );
    };
    const labelOf = (one) => (one.required ? t("networks.wizard.required", {key: one.key}) : one.key);

    return (
        <Dialog
            open
            size="md"
            title={edit ? t("networks.wizard.editTitle", {name: trimmedName}) : t("networks.wizard.title", {name: trimmedName || "…"})}
            onClose={onClose}
            footer={(
                <>
                    <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                    {index > 0 && <Button variant="secondary" onClick={() => setStep(STEPS[index - 1])} disabled={saving}>{t("networks.wizard.back")}</Button>}
                    {step === "review" ? (
                        <Button variant={edit ? "change" : "create"} onClick={save} disabled={saving || unchanged}>
                            {saving ? t("networks.wizard.saving") : t(edit ? "networks.wizard.update" : "networks.wizard.save")}
                        </Button>
                    ) : (
                        <Button variant="secondary" onClick={() => setStep(STEPS[index + 1])} disabled={!canNext}>{t("networks.wizard.next")}</Button>
                    )}
                </>
            )}
        >
            {keywords === null && !error && <Spinner/>}
            {keywords === null && error && <Alert tone="error">{t("networks.wizard.readFailed", {message: error})}</Alert>}
            {keywords !== null && (
                <div className="space-y-4">
                    <ol aria-label={t("networks.wizard.steps")} className="flex flex-wrap gap-x-3 gap-y-1 text-data">
                        {STEPS.map((s, i) => (
                            <li key={s} aria-current={s === step ? "step" : undefined} className={s === step ? "font-semibold text-ink" : "text-ink-muted"}>
                                {`${i + 1}. ${t(`networks.wizard.step.${s}`)}`}
                            </li>
                        ))}
                    </ol>

                    {step === "type" && (
                        <div className="space-y-4">
                            <Field label={t("networks.wizard.name")} hint={edit ? t("networks.wizard.nameKept") : t("networks.wizard.nameHint")} error={nameError || undefined}>
                                {(props) => (
                                    <Input {...props} value={name} onChange={(event) => setName(event.target.value)} readOnly={Boolean(edit)}
                                           autoComplete="off" spellCheck={false} autoFocus={!edit}/>
                                )}
                            </Field>
                            <fieldset className="space-y-2">
                                <legend className="mb-1 font-medium">{t("networks.wizard.typeQuestion")}</legend>
                                {types.map((kind) => (
                                    <label key={kind} className="flex cursor-pointer items-start gap-2 rounded-(--radius-control) border border-line p-2 hover:bg-surface-sunken">
                                        <input type="radio" name="network-type" value={kind} checked={type === kind} onChange={() => setType(kind)} className="mt-1"/>
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
                                    {nodes.map((node) => field({...one, keyword: {...one.keyword, text: ""}}, `${one.key}@${node}`, t("networks.wizard.onNode", {key: one.key, node})))}
                                </fieldset>
                            ) : field(one, one.key, labelOf(one))))}
                            {overlaps.length > 0 && <Alert tone="warning">{t("networks.wizard.overlaps", {networks: overlaps.join(", ")})}</Alert>}
                        </div>
                    )}

                    {step === "review" && (
                        <div className="space-y-3">
                            {editOps?.rewrite && <Alert tone="warning">{t("networks.wizard.rewrite", {from: original.type, to: type})}</Alert>}
                            <div>
                                <p className="mb-1 text-data text-ink-muted">{t("networks.wizard.written")}</p>
                                <pre data-testid="network-preview" className="rounded-(--radius-control) border border-line bg-surface-sunken p-2 font-mono text-data">
                                    {edit ? networkEditPreview(trimmedName, type, original, values, keys) : networkPreview(trimmedName, type, own)}
                                </pre>
                            </div>
                            {unchanged && <p className="text-ink-muted">{t("networks.wizard.unchanged")}</p>}
                            {overlaps.length > 0 && <Alert tone="warning">{t("networks.wizard.overlaps", {networks: overlaps.join(", ")})}</Alert>}
                            {error && <Alert tone="error">{t("networks.wizard.saveFailed", {message: error})}</Alert>}
                        </div>
                    )}
                </div>
            )}
        </Dialog>
    );
}
