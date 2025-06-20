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

    // Obtenir les types (kinds) des objets sélectionnés
    const selectedKinds = [...new Set(selectedObjects.map(extractKind))];

    // Si un seul type est sélectionné, appliquer les restrictions de ce type
    if (selectedKinds.length === 1) {
        const kind = selectedKinds[0];
        const allowedActions = ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default;
        return allowedActions.includes(actionName);
    }

    // Si plusieurs types sont sélectionnés, trouver l'intersection des actions autorisées
    const allowedActionsSets = selectedKinds.map(kind =>
        new Set(ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default)
    );
    const commonActions = [...allowedActionsSets[0]].filter(action =>
        allowedActionsSets.every(set => set.has(action))
    );

    return commonActions.includes(actionName);
};

export { extractNamespace, extractKind, isActionAllowedForSelection, ALLOWED_ACTIONS_BY_KIND };