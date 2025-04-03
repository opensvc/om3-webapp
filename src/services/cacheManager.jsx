export const updateCacheWithPatch = (cache, patchData) => {
    return cache.map((node) =>
        patchData[node.nodename] ? { ...node, ...patchData[node.nodename] } : node
    );
};