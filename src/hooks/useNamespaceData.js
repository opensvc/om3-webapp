import {useMemo} from 'react';
import useEventStore from './useEventStore';

const selectObjectStatus = (state) => state.objectStatus;

const extractNamespace = (objectName) => {
    const parts = objectName.split("/");
    return parts.length === 3 ? parts[0] : "root";
};

export const useNamespaceData = () => {
    const objectStatus = useEventStore(selectObjectStatus);

    return useMemo(() => {
        const allObjectNames = Object.keys(objectStatus).filter(
            (key) => key && typeof objectStatus[key] === "object"
        );

        const statusByNamespace = {};
        const namespacesSet = new Set();

        for (let i = 0; i < allObjectNames.length; i++) {
            const name = allObjectNames[i];
            const ns = extractNamespace(name);
            namespacesSet.add(ns);

            const status = objectStatus[name]?.avail || "n/a";

            if (!statusByNamespace[ns]) {
                statusByNamespace[ns] = {up: 0, down: 0, warn: 0, "n/a": 0};
            }

            if (statusByNamespace[ns][status] !== undefined) {
                statusByNamespace[ns][status]++;
            } else {
                statusByNamespace[ns]["n/a"]++;
            }
        }

        return {
            statusByNamespace,
            namespaces: Array.from(namespacesSet).sort(),
            allObjectNames
        };
    }, [objectStatus]);
};
