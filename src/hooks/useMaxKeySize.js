import {useEffect, useState} from "react";
import {URL_CLUSTER_STATUS} from "../config/apiPath.js";

/*
 * The largest key the API takes: `node.max_key_size` of the node serving it, the
 * one a key is posted to, read in the cluster status. Read once a session.
 */

let reading = null;

/** Forgets the size read, for the tests. */
export const resetMaxKeySize = () => {
    reading = null;
};

const read = async () => {
    const token = localStorage.getItem("authToken");
    const response = await fetch(URL_CLUSTER_STATUS, {headers: {Authorization: `Bearer ${token}`}});
    if (!response.ok) return null;
    const status = await response.json();
    const size = status?.cluster?.node?.[status?.daemon?.nodename]?.config?.max_key_size;
    return typeof size === "number" && size > 0 ? size : null;
};

/**
 * The largest key, in bytes, once read while `enabled`; null while read or when it
 * could not be: the API then says it alone, refusing a key too large (413).
 */
export function useMaxKeySize(enabled = true) {
    const [max, setMax] = useState(null);
    useEffect(() => {
        if (!enabled) return undefined;
        let live = true;
        if (reading === null) reading = read().catch(() => null);
        const current = reading;
        current.then((size) => {
            // Not read: tried again next time.
            if (size === null && reading === current) reading = null;
            if (live) setMax(size);
        });
        return () => {
            live = false;
        };
    }, [enabled]);
    return max;
}
