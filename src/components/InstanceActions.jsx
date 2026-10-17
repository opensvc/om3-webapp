import React, {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Alert} from "../ui/components/Alert";
import {IconButton} from "../ui/components/Button";
import {CloseIcon, RefreshIcon} from "../ui/icons";
import {INSTANCE_ACTIONS, OBJECT_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";
import {CrossLink} from "../app/CrossLink";
import ActionDialogManager from "./ActionDialogManager";
import ConsoleTerminal from "./ConsoleTerminal.jsx";
import {CLEAR_ACTION, postAction} from "./objectActions";
import {parseObjectPath} from "../utils/objectUtils.jsx";

/** Icon of an action in a menu: the action icons are sized to the menu line. */
const ICON = "flex h-4 w-4 items-center justify-center text-ink-muted [&>svg]:h-4! [&>svg]:w-4!";
const DANGER_ICON = "flex h-4 w-4 items-center justify-center text-state-down [&>svg]:h-4! [&>svg]:w-4!";

export const actionIcon = ({icon, color}) => (
    <span aria-hidden="true" className={color === "red" ? DANGER_ICON : ICON}>{icon}</span>
);

/** Every action the dialogs may have to confirm. */
const SUPPORTED_ACTIONS = [...new Set([...OBJECT_ACTIONS, ...INSTANCE_ACTIONS, ...RESOURCE_ACTIONS, CLEAR_ACTION].map((a) => a.name))];

/** The feedback message hides itself after a while, as in the other views. */
const FEEDBACK_DURATION_MS = 5000;

/**
 * The actions on the instances and resources of an object, as the status board
 * runs them: `ask` an action on its targets — one entry per node, with the
 * resources it runs on there as `rid` — confirmed first, then posted, what came of
 * it said; a console opens a terminal on its resource at once. `onDone` follows a
 * run, to clear a selection. Render `feedback` where it is said, `dialogs` once.
 */
export function useActionRunner(path) {
    const {t} = useTranslation();
    const [pending, setPending] = useState(null);
    const [running, setRunning] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [consoleTarget, setConsoleTarget] = useState(null);

    useEffect(() => {
        if (feedback === null) return undefined;
        const timer = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS);
        return () => clearTimeout(timer);
    }, [feedback]);

    const ask = useCallback((action, {targets, subject, onDone}) => {
        if (action === "console") {
            const {namespace, kind, name} = parseObjectPath(path);
            setConsoleTarget({node: targets[0].node, namespace, kind, name, rid: targets[0].rid});
            return;
        }
        setPending({action, targets, subject, onDone});
    }, [path]);

    const run = useCallback(async () => {
        if (pending === null) return;
        const {action, subject, targets, onDone} = pending;
        setPending(null);
        setRunning(true);
        setFeedback({tone: "info", message: t("statusBoard.feedback.running", {action, subject})});
        const posts = targets.map(({node, rid}) => ({path, action, node, rid}));
        const results = await Promise.all(posts.map((target) => postAction(target).catch((err) => ({detail: err.message}))));
        const failures = results
            .map((r, i) => (r === null ? null : `${posts[i].node}: ${r.status ? `HTTP ${r.status}` : ""}${r.detail ? ` ${r.detail}` : ""}`.trim()))
            .filter((r) => r !== null);
        setFeedback(failures.length === 0
            ? {tone: "success", message: t("statusBoard.feedback.accepted", {action, subject})}
            : {tone: "error", message: t("statusBoard.feedback.failed", {action, subject, detail: failures.join("; ")})});
        onDone?.();
        setRunning(false);
    }, [pending, path, t]);

    const feedbackAlert = feedback === null ? null : (
        <Alert
            tone={feedback.tone}
            action={
                <IconButton label={t("common.close")} bare onClick={() => setFeedback(null)}>
                    <CloseIcon className="h-4 w-4"/>
                </IconButton>
            }
        >
            {feedback.message}
        </Alert>
    );
    const dialogs = (
        <>
            <ActionDialogManager
                pendingAction={pending}
                handleConfirm={run}
                target={pending?.subject ?? ""}
                supportedActions={SUPPORTED_ACTIONS}
                onClose={() => setPending(null)}
            />
            <ConsoleTerminal open={consoleTarget !== null} target={consoleTarget} onClose={() => setConsoleTarget(null)}/>
        </>
    );
    return {ask, running, feedback: feedbackAlert, dialogs};
}

/**
 * Refreshes the status of the instances of an object on the nodes given, as `om
 * <path> instance status -r` does on each: no confirmation, it changes nothing but the
 * status, which the events then bring. Turning while asked; a node refusing, said.
 */
export function RefreshStatusButton({path, nodes}) {
    const {t} = useTranslation();
    const [refreshing, setRefreshing] = useState(false);
    const [failure, setFailure] = useState(null);
    if (nodes.length === 0) return null;
    const refresh = async () => {
        setRefreshing(true);
        setFailure(null);
        const results = await Promise.all(nodes.map((node) => postAction({path, action: "status", node})
            .catch((err) => ({detail: err.message}))));
        const failures = results
            .map((r, i) => (r === null ? null : `${nodes[i]}: ${r.status ? `HTTP ${r.status}` : ""}${r.detail ? ` ${r.detail}` : ""}`.trim()))
            .filter((r) => r !== null);
        setFailure(failures.length > 0 ? failures.join("; ") : null);
        setRefreshing(false);
    };
    return (
        <span className="inline-flex shrink-0 items-center gap-2">
            {failure && (
                <span role="alert" className="text-data text-state-down">{t("statusBoard.refreshFailed", {detail: failure})}</span>
            )}
            <IconButton
                label={nodes.length > 1 ? t("statusBoard.refreshAll") : t("statusBoard.refresh")}
                onClick={refresh}
                disabled={refreshing}
                aria-busy={refreshing || undefined}
            >
                <RefreshIcon className={refreshing ? "animate-spin" : undefined}/>
            </IconButton>
        </span>
    );
}

/** The datastores the resources given use — the cfg and sec objects they install from — once each, sorted. */
export function datastoresOf(resources) {
    return [...new Set(resources.flatMap((r) => r?.datastores ?? []))].sort((a, b) => a.localeCompare(b));
}

/** The datastores, a badge each opening its object panel. */
export function DatastoreLinks({paths}) {
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            {paths.map((p) => <CrossLink key={p} kind="object" id={p}>{p}</CrossLink>)}
        </span>
    );
}
