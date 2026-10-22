import React, {useState} from "react";
import {useSearchParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Alert} from "../ui/components/Alert";
import {Button, IconButton} from "../ui/components/Button";
import {CopyButton} from "../ui/components/CopyButton";
import {Field, Input, Textarea} from "../ui/components/Field";
import {Spinner} from "../ui/components/Spinner";
import {EyeIcon, EyeOffIcon, KeyIcon} from "../ui/icons";
import {URL_TOKEN} from "../config/apiPath.js";
import {getResponseErrorMessage} from "../services/api.jsx";

/** The lifetime of a token by default: a join one must outlive the drain of the node. */
const DEFAULT_DURATION = {join: "1h"};

/** Ignored by the password managers but for the credentials themselves. */
const NOT_A_LOGIN = {
    autoComplete: "off",
    spellCheck: false,
    "data-protonpass-ignore": "true",
    "data-1p-ignore": "true",
    "data-lpignore": "true",
    "data-bwignore": "true",
    "data-form-type": "other",
};

/**
 * A token of this node, created by its own api (`/api/auth/token`): of the role the
 * address names (`?role=join`), for its lifetime, then copied. The node to enroll
 * into a cluster is opened here, from the Enroll dialog of that cluster: its
 * certificate accepted on the way, no other origin asked anything.
 *
 * om3 creates a token for a user signed in with a password, or from a refresh
 * token: the one of a password session of this webapp is used when there is one;
 * otherwise, the username and password of a user of this node are asked, sent to
 * this node alone. A session opened with OpenID cannot create one.
 */
export default function TokenPage() {
    const {t} = useTranslation();
    const [params] = useSearchParams();
    const role = params.get("role") ?? "";
    const [duration, setDuration] = useState(DEFAULT_DURATION[role] ?? "10m");
    const refresh = (() => {
        try {
            return localStorage.getItem("refreshToken") || "";
        } catch {
            return "";
        }
    })();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [token, setToken] = useState(null);
    const [shown, setShown] = useState(false);

    const useCredentials = refresh === "";
    const ready = !creating && duration.trim() !== "" && (!useCredentials || (username !== "" && password !== ""));

    const create = async (event) => {
        event?.preventDefault();
        if (!ready) return;
        setCreating(true);
        setError(null);
        setToken(null);
        setShown(false);
        try {
            const query = new URLSearchParams({access_duration: duration.trim(), refresh: "false"});
            if (role) query.set("role", role);
            const response = await fetch(`${URL_TOKEN}?${query}`, {
                method: "POST",
                headers: {
                    Authorization: useCredentials ? `Basic ${btoa(`${username}:${password}`)}` : `Bearer ${refresh}`,
                },
            });
            if (!response.ok) {
                setError(await getResponseErrorMessage(response) || `HTTP ${response.status}`);
                return;
            }
            const data = await response.json();
            setToken({value: data.access_token, expires: data.access_expired_at});
            setPassword("");
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-4 p-4">
            <div className="flex items-center gap-2">
                <KeyIcon className="text-ink-muted"/>
                <h1 className="text-title font-semibold">{t("tokenPage.title", {host: window.location.host})}</h1>
            </div>
            <p>{role === "join" ? t("tokenPage.joinIntro") : t("tokenPage.intro")}</p>

            <form onSubmit={create} noValidate className="space-y-3 rounded-(--radius-panel) border border-line bg-surface-raised p-3">
                <div className="flex flex-wrap gap-3">
                    <Field label={t("tokenPage.role")}>
                        {(control) => <Input {...control} {...NOT_A_LOGIN} value={role || t("tokenPage.allRoles")} readOnly className="w-40"/>}
                    </Field>
                    <Field label={t("tokenPage.duration")} hint={t("tokenPage.durationHint")}>
                        {(control) => (
                            <Input {...control} {...NOT_A_LOGIN} name="token-duration" value={duration}
                                   onChange={(e) => setDuration(e.target.value)} className="w-32"/>
                        )}
                    </Field>
                </div>
                {useCredentials ? (
                    <>
                        <p className="text-ink-muted">{t("tokenPage.credentialsWhy")}</p>
                        <div className="flex flex-wrap gap-3">
                            <Field label={t("tokenPage.username")}>
                                {(control) => (
                                    <Input {...control} name="username" autoComplete="username" value={username}
                                           onChange={(e) => setUsername(e.target.value)} className="w-56"/>
                                )}
                            </Field>
                            <Field label={t("tokenPage.password")}>
                                {(control) => (
                                    <Input {...control} type="password" name="password" autoComplete="current-password"
                                           value={password} onChange={(e) => setPassword(e.target.value)} className="w-56"/>
                                )}
                            </Field>
                        </div>
                    </>
                ) : (
                    <p className="text-ink-muted">{t("tokenPage.fromSession")}</p>
                )}
                <div className="flex items-center gap-2">
                    <Button type="submit" variant="create" disabled={!ready}
                            icon={creating ? <Spinner label={t("tokenPage.creating")}/> : undefined}>
                        {creating ? t("tokenPage.creating") : t("tokenPage.create")}
                    </Button>
                </div>
                {error && <Alert>{t("tokenPage.refused", {message: error})}</Alert>}
            </form>

            {token && (
                <section aria-labelledby="token-result" className="space-y-2 rounded-(--radius-panel) border border-line bg-surface-raised p-3">
                    <div className="flex items-center gap-2">
                        <h2 id="token-result" className="font-semibold">{t("tokenPage.token")}</h2>
                        {token.expires && (
                            <span className="text-data text-ink-muted">{t("tokenPage.expires", {at: new Date(token.expires).toLocaleString()})}</span>
                        )}
                        <span className="ml-auto flex items-center gap-1">
                            <IconButton label={shown ? t("tokenPage.hide") : t("tokenPage.reveal")} aria-pressed={shown}
                                        onClick={() => setShown((s) => !s)}>
                                {shown ? <EyeOffIcon/> : <EyeIcon/>}
                            </IconButton>
                            <CopyButton size="md" text={token.value} label={t("tokenPage.copy")}/>
                        </span>
                    </div>
                    <Textarea
                        {...NOT_A_LOGIN}
                        aria-label={t("tokenPage.token")}
                        readOnly
                        rows={4}
                        value={shown ? token.value : "•".repeat(Math.min(token.value.length, 64))}
                        className="font-mono text-data break-all"
                    />
                    {role === "join" && <p className="text-ink-muted">{t("tokenPage.joinNext")}</p>}
                </section>
            )}
        </div>
    );
}
