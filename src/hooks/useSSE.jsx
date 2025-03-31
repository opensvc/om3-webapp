import { useEffect } from "react";
import { useStateValue } from "../state";

const useSSE = (token) => {
    const [, dispatch] = useStateValue();

    useEffect(() => {
        if (!token) return;

        console.log("🔄 Attempting SSE connection with token:", token);
        const eventSource = new EventSource("/sse", {
            headers: { "Authorization": `Bearer ${token}` },
        });

        eventSource.onopen = () => {
            console.log("✅ SSE connected!");
            dispatch({ type: "setEventSourceAlive", data: true });
        };

        eventSource.onerror = (error) => {
            console.error("❌ SSE error:", error);
            dispatch({ type: "setEventSourceAlive", data: false });
            eventSource.close();
        };

        eventSource.onmessage = (event) => {
            console.log("📩 SSE message received:", event.data);
        };

        return () => {
            console.log("❌ Closing SSE connection.");
            eventSource.close();
        };
    }, [token, dispatch]);
};

export default useSSE;