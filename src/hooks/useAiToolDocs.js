import {useEffect, useState} from 'react';

// The documentation of the tools, by their name, as /tools gives it: read
// once per client, when first needed, such as by a confirmation card. A
// failure leaves it empty: the card shows the call without it.
export default function useAiToolDocs(client, needed) {
    const [docs, setDocs] = useState({client: null, tools: null});
    const loaded = docs.client === client && docs.tools !== null;

    useEffect(() => {
        if (!needed || !client || loaded) return;
        const controller = new AbortController();
        // A failure, thrown or rejected, leaves the docs empty.
        Promise.resolve().then(() => client.listTools({signal: controller.signal})).then(
            (tools) => setDocs({client, tools: new Map(tools.map((tool) => [tool.name, tool]))}),
            () => undefined
        );
        return () => controller.abort();
    }, [needed, client, loaded]);

    return loaded ? docs.tools : null;
}
