import React, {useCallback} from "react";
import {TableCell, Box} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

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

export const parseObjectPath = (objName) => {
    if (!objName || typeof objName !== "string") {
        return {namespace: "root", kind: "svc", name: ""};
    }
    const parts = objName.split("/");
    let name, kind, namespace;
    if (parts.length === 3) {
        namespace = parts[0];
        kind = parts[1];
        name = parts[2];
    } else if (parts.length === 2) {
        namespace = "root";
        kind = parts[0];
        name = parts[1];
    } else {
        namespace = "root";
        name = parts[0];
        kind = name === "cluster" ? "ccfg" : "svc";
    }
    return {namespace, kind, name};
};

const extractNamespace = (name) => {
    const {namespace} = parseObjectPath(name);
    return namespace;
};

const extractKind = (name) => {
    const {kind} = parseObjectPath(name);
    return kind;
};

const isActionAllowedForSelection = (actionName, selectedObjects) => {
    if (selectedObjects.length === 0) return false;

    const selectedKinds = [...new Set(selectedObjects.map(extractKind))];

    if (selectedKinds.length === 1) {
        const kind = selectedKinds[0];
        const allowedActions = ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default;
        return allowedActions.includes(actionName);
    }

    const allowedActions = new Set();
    selectedKinds.forEach(kind => {
        const actions = ALLOWED_ACTIONS_BY_KIND[kind] || ALLOWED_ACTIONS_BY_KIND.default;
        actions.forEach(action => allowedActions.add(action));
    });

    return allowedActions.has(actionName);
};

export const SortableTableCell = React.memo(
    ({column, label, currentSortColumn, sortDirection, onSort, align = "left"}) => {
        const handleClick = useCallback(() => {
            onSort(column);
        }, [onSort, column]);

        return (
            <TableCell align={align} onClick={handleClick} sx={{cursor: "pointer"}}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: align === "center" ? "center" : "flex-start",
                        gap: 0.5,
                    }}
                >
                    <strong>{label}</strong>
                    {currentSortColumn === column &&
                        (sortDirection === "asc" ? (
                            <KeyboardArrowUpIcon fontSize="small"/>
                        ) : (
                            <KeyboardArrowDownIcon fontSize="small"/>
                        ))}
                </Box>
            </TableCell>
        );
    },
    (prev, next) =>
        prev.column === next.column &&
        prev.currentSortColumn === next.currentSortColumn &&
        prev.sortDirection === next.sortDirection
);

export {extractNamespace, extractKind, isActionAllowedForSelection, ALLOWED_ACTIONS_BY_KIND};
