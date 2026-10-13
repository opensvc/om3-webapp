import {URL_NODE, URL_OBJECT} from "../config/apiPath.js";
import {INSTANCE_ACTIONS, NODE_ACTIONS, OBJECT_ACTIONS, RESOURCE_ACTIONS} from "../constants/actions";
import {getResponseErrorMessage} from "../services/api.jsx";
import {parseObjectPath} from "../utils/objectUtils.jsx";

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
    if (node === undefined) {
        const endpoint = OBJECT_ACTIONS.find((a) => a.name === action)?.endpoint ?? `action/${action}`;
        return `${URL_OBJECT}/${pathParts(path)}/${endpoint}`;
    }
    const base = `${URL_NODE}/${encodeURIComponent(node)}/instance/path/${pathParts(path)}`;
    if (action === CLEAR_ACTION.name && rid === undefined) return `${base}/clear`;
    const instance = `${base}/action`;
    if (rid !== undefined) return `${instance}/${encodeURIComponent(action)}?rid=${encodeURIComponent(rid)}`;
    const endpoint = INSTANCE_ACTIONS.find((a) => a.name === action)?.endpoint ?? action;
    return `${instance}/${endpoint}`;
}

/**
 * Posts an action; resolves to null when the daemon accepted it, to the reason it
 * gave otherwise ({status, detail}).
 */
export async function postAction(target) {
    const token = localStorage.getItem("authToken");
    const response = await fetch(actionUrl(target), {
        method: "POST",
        headers: {Authorization: `Bearer ${token}`},
    });
    if (response.ok) return null;
    return {status: response.status, detail: await getResponseErrorMessage(response)};
}

/**
 * The actions a resource takes, by its driver group, as the instance view offered
 * them: a task runs, a filesystem, a disk or an app starts and stops. Only a
 * container has a console: it is a shell inside it.
 */
export function resourceActions(rid) {
    const group = rid.split("#")[0].toLowerCase();
    const actions = RESOURCE_ACTIONS.filter((a) => a.name !== "console" || group === "container");
    if (group === "task") return actions.filter((a) => a.name === "run");
    if (["fs", "disk", "app", "container"].includes(group)) return actions.filter((a) => a.name !== "run");
    return actions;
}
