import {useEffect, useState} from "react";
import {URL_NODE} from "../config/apiPath.js";
import {authHeaders} from "../services/api.jsx";

/** The names of the capabilities a node answers, as `om node capabilities list`. */
async function readCapabilities(node) {
    const response = await fetch(`${URL_NODE}/${encodeURIComponent(node)}/capabilities`, {headers: authHeaders(), cache: "no-cache"});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    return (body?.items ?? []).map((item) => item?.data?.name).filter(Boolean);
}

/**
 * The capabilities of each node of `nodes`, read once each: `{node: names}`, a node
 * not read yet, or that could not be, undefined: nothing said of it.
 */
export function useNodeCapabilities(nodes) {
    const [byNode, setByNode] = useState({});
    const key = [...new Set(nodes ?? [])].sort().join(" ");
    useEffect(() => {
        let live = true;
        const list = key === "" ? [] : key.split(" ");
        setByNode(Object.fromEntries(list.map((node) => [node, undefined])));
        for (const node of list) {
            readCapabilities(node).then(
                (caps) => live && setByNode((current) => ({...current, [node]: caps})),
                () => {},
            );
        }
        return () => {
            live = false;
        };
    }, [key]);
    return byNode;
}
