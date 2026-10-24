import {URL_CLUSTER, URL_NODE, URL_OBJECT} from "../config/apiPath.js";
import {INSTANCE_ACTIONS, NODE_ACTIONS, OBJECT_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";
import {getResponseErrorMessage} from "../services/api.jsx";
import {parseObjectPath} from "../utils/objectUtils.jsx";
import {trackRefused, trackResponse} from "../app/action-tracker";
import i18n from "../i18n";

/*
 * The actions on an object, as om runs them: on the object (the orchestration
 * deciding where), on the instance of a node, or on a resource of an instance,
 * `om <path> <action> [--node <node>] [--rid <rid>]`.
 */

const pathParts = (path) => {
    const {namespace, kind, name} = parseObjectPath(path);
    return [namespace, kind, name].map(encodeURIComponent).join("/");
};

/**
 * Clears the failed state of an instance monitor, for the orchestration to try
 * again: no action of the instance, it has an address of its own.
 */
export const CLEAR_ACTION = {name: "clear", icon: NODE_ACTIONS.find((a) => a.name === "clear")?.icon};

/** The address of an action, given what it acts on. */
export function actionUrl({path, action, node, rid}) {
    // The cluster object is acted on as the cluster, on all the nodes: `om cluster
    // freeze`, not the freeze of an object.
    // Its instance on a node stands for the node: `om node freeze`. The cluster
    // object's own instance freeze is no node freeze, nothing a user would see.
    if (parseObjectPath(path).kind === "ccfg" && rid === undefined) {
        return node === undefined
            ? `${URL_CLUSTER}/action/${encodeURIComponent(action)}`
            : `${URL_NODE}/${encodeURIComponent(node)}/action/${encodeURIComponent(action)}`;
    }
    if (node === undefined) {
        const endpoint = OBJECT_ACTIONS.find((a) => a.name === action)?.endpoint ?? `action/${action}`;
        return `${URL_OBJECT}/${pathParts(path)}/${endpoint}`;
    }
    const base = `${URL_NODE}/${encodeURIComponent(node)}/instance/path/${pathParts(path)}`;
    if (action === CLEAR_ACTION.name && rid === undefined) return `${base}/clear`;
    const instance = `${base}/action`;
    // On resources: the endpoint of the action, "sync update" at "update", the resources picked by `rid`.
    if (rid !== undefined) {
        const endpoint = RESOURCE_ACTIONS.find((a) => a.name === action)?.endpoint
            ?? INSTANCE_ACTIONS.find((a) => a.name === action)?.endpoint ?? encodeURIComponent(action);
        return `${instance}/${endpoint}?rid=${encodeURIComponent(rid)}`;
    }
    const endpoint = INSTANCE_ACTIONS.find((a) => a.name === action)?.endpoint ?? action;
    return `${instance}/${endpoint}`;
}

/** Actions with nothing to follow: a refresh of the status, a clear of a failed monitor. */
const UNTRACKED = ["status", CLEAR_ACTION.name, "console"];

/** What an action acts on, in words, for the actions tray. */
export function actionSubject({path, node, rid}) {
    if (parseObjectPath(path).kind === "ccfg" && rid === undefined) return node ?? i18n.t("actionTray.subjects.cluster");
    if (rid !== undefined) return i18n.t("actionTray.subjects.resource", {rid, path, node});
    if (node !== undefined) return i18n.t("actionTray.subjects.instance", {path, node});
    return path;
}

/** A refusal in words: its status and the reason the daemon gave. */
export const refusalReason = ({status, detail}) => [status ? `HTTP ${status}` : "", detail ?? ""].join(" ").trim();

/**
 * Posts an action; resolves to null when the daemon accepted it, to the reason it
 * gave otherwise ({status, detail}). Accepted, it is followed to its end in the
 * actions tray; refused, or not sent, it is said there too.
 */
export async function postAction(target) {
    const tracked = !UNTRACKED.includes(target.action);
    const subject = actionSubject(target);
    let response;
    try {
        response = await fetch(actionUrl(target), {
            method: "POST",
            headers: {Authorization: `Bearer ${localStorage.getItem("authToken")}`},
        });
    } catch (err) {
        if (tracked) trackRefused({action: target.action, subject, reason: err.message});
        return {detail: err.message};
    }
    if (response.ok) {
        if (tracked) {
            await trackResponse(response, {action: target.action, subject, node: target.node, path: target.path});
        }
        return null;
    }
    const refusal = {status: response.status, detail: await getResponseErrorMessage(response)};
    if (tracked) trackRefused({action: target.action, subject, reason: refusalReason(refusal)});
    return refusal;
}

/** The actions whose words differ for a store: a sync of a store backs up, into the store, no peer. */
const STORE_WORDED = ["sync update", "sync full"];

/**
 * The words of the action `name` on resources of these driver `types`: "Store", a
 * backup into their store, all of them `sync.store`; "Either", to the peers or into a
 * store, some of them; "", to the peers.
 */
export function syncVariant(name, types) {
    if (!STORE_WORDED.includes(name)) return "";
    const syncs = types.filter((type) => /^(sync|disk)\./.test(String(type)) || String(type) === "sync");
    const stores = syncs.filter((type) => type === "sync.store").length;
    if (stores === 0) return "";
    return stores === syncs.length ? "Store" : "Either";
}

/**
 * The actions a resource takes, by its driver `type` ("sync.rsync", `RESOURCE_ACTIONS`):
 * a task runs, a sync resource replicates, a disk reserves its devices, a container
 * has a console. Its type unknown, the group of its id: the actions of its group alone.
 */
export function resourceActions(rid, type) {
    const known = type && String(type).includes(".") ? String(type).toLowerCase() : rid.split("#")[0].toLowerCase();
    return RESOURCE_ACTIONS.filter((a) => a.on(known));
}
