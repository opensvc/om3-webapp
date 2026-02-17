import {useMemo, useDeferredValue} from 'react';
import useEventStore from './useEventStore';
import {extractKind} from '../utils/objectUtils';

export const useKindData = () => {
    const objectStatus = useEventStore((state) => state.objectStatus);
    const deferredObjectStatus = useDeferredValue(objectStatus);

    return useMemo(() => {
        const kindMap = new Map(); // kind -> { up, down, warn, unprovisioned, n/a }

        for (const [objectPath, status] of Object.entries(deferredObjectStatus)) {
            const kind = extractKind(objectPath);
            if (!kind) continue;

            if (!kindMap.has(kind)) {
                kindMap.set(kind, {up: 0, down: 0, warn: 0, unprovisioned: 0, 'n/a': 0});
            }

            const counts = kindMap.get(kind);
            const avail = status?.avail?.toLowerCase() || 'n/a';
            const provisioned = status?.provisioned;

            // Global status
            if (avail === 'up' || avail === 'down' || avail === 'warn') {
                counts[avail]++;
            } else {
                counts['n/a']++;
            }

            // Unprovisioned (if not provisioned)
            if (provisioned === 'false' || provisioned === false) {
                counts.unprovisioned++;
            }
        }

        // Convert Map to object and sort kinds
        const statusByKind = Object.fromEntries(kindMap);
        const kinds = Array.from(kindMap.keys()).sort((a, b) => a.localeCompare(b));

        return {statusByKind, kinds};
    }, [deferredObjectStatus]);
};
