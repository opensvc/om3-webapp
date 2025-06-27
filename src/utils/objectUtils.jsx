const ALLOWED_ACTIONS_BY_KIND = {
    cfg: ["abort", "delete"],
    vol: ["abort", "delete", "freeze", "provision", "purge", "unfreeze", "unprovision"],
    sec: ["abort", "delete"],
    usr: ["abort", "delete"],
    default: [
        "start",
        "stop",
        "restart",
        "freeze",
        "unfreeze",
        "delete",
        "provision",
        "unprovision",
        "purge",
        "switch",
        "giveback",
        "abort",
    ],
};

const extractNamespace = (name) => {
    const parts = name.split("/");
    return parts.length === 3 ? parts[0] : "root";
};

const extractKind = (name) => {
    const parts = name.split("/");
    if (parts.length === 3) {
        // Format: namespace/kind/name
        return parts[1];
    } else if (parts.length === 2) {
        // Format: kind/name (namespace = root)
        return parts[0];
    } else {
        // Format: name
        const objName = parts[0];
        return objName === "cluster" ? "ccfg" : "svc";
    }
};

const isActionAllowedForSelection = (actionName, selectedObjects) => {
    if (selectedObjects.length === 0) return false;

    // Get the kinds of the selected objects
    const selectedKinds = [...new Set(selectedObjects.map(extractKind))];

    // If only one kind is selected, apply the restrictions for that kind
    if (selectedKinds.length === 1) {
        const kind = selectedKinds[0];
        const allowedActions = ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default;
        return allowedActions.includes(actionName);
    }

    // If multiple kinds are selected, find the union of allowed actions
    const allowedActions = new Set();
    selectedKinds.forEach(kind => {
        const actions = ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default;
        actions.forEach(action => allowedActions.add(action));
    });

    return allowedActions.has(actionName);
};

export { extractNamespace, extractKind, isActionAllowedForSelection, ALLOWED_ACTIONS_BY_KIND };