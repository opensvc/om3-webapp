import {
    CONSOLE_MSG_RESIZE,
    consoleCertificateUrl,
    consoleUrl,
    openConsoleSession,
    requestConsoleTicket,
} from "../console-service.js";

// FakeWebSocket records what a session sends, and lets a test play the node.
class FakeWebSocket {
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        this.closed = false;
        FakeWebSocket.instances.push(this);
    }

    send(data) {
        this.sent.push(data);
    }

    close() {
        this.closed = true;
        this.readyState = 3;
        this.onclose?.({});
    }

    open() {
        this.readyState = 1;
        this.onopen?.();
    }
}

const target = {node: "n1", namespace: "ns1", kind: "svc", name: "web", rid: "container#1", token: "tok"};

describe("requestConsoleTicket", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("posts to the console handler of the instance, and returns the ticket", async () => {
        const ticket = {ticket: "T", port: 1216, expired_at: "2026-01-01T00:00:00Z"};
        global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ticket});
        await expect(requestConsoleTicket(target)).resolves.toEqual(ticket);
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/node/name/n1/instance/path/ns1/svc/web/console?rid=container%231",
            {method: "POST", headers: {Authorization: "Bearer tok"}},
        );
    });

    test("names no resource when there is none to name", async () => {
        global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({ticket: "T", port: 1216})});
        await requestConsoleTicket({...target, rid: undefined});
        expect(global.fetch.mock.calls[0][0]).toBe("/api/node/name/n1/instance/path/ns1/svc/web/console");
    });

    test("says why the api refused", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: async () => JSON.stringify({detail: "not allowed"}),
        });
        await expect(requestConsoleTicket(target)).rejects.toThrow("HTTP 403: not allowed");
    });

    test("says the status when the api does not explain", async () => {
        global.fetch = vi.fn().mockResolvedValue({ok: false, status: 500, text: async () => ""});
        await expect(requestConsoleTicket(target)).rejects.toThrow("HTTP 500");
    });

    test("refuses an answer with no ticket", async () => {
        global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({port: 1216})});
        await expect(requestConsoleTicket(target)).rejects.toThrow("no console ticket");
        global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => null});
        await expect(requestConsoleTicket(target)).rejects.toThrow("no console ticket");
    });
});

describe("consoleUrl", () => {
    test("is the console port of the host the api is reached on", () => {
        expect(consoleUrl({ticket: "a.b.c", port: 1216}, {hostname: "node1.example.com"}))
            .toBe("wss://node1.example.com:1216/?ticket=a.b.c");
    });

    test("is the url the cluster configures when it configures one", () => {
        expect(consoleUrl({ticket: "T", port: 1216, url: "wss://access.example.com/opensvc-console/"}, {hostname: "x"}))
            .toBe("wss://access.example.com/opensvc-console/?ticket=T");
    });

    test("takes a https url for the websocket it is", () => {
        expect(consoleUrl({ticket: "T", port: 1216, url: "https://access.example.com/c/"}, {hostname: "x"}))
            .toBe("wss://access.example.com/c/?ticket=T");
    });

    test("defaults to the location of the page", () => {
        expect(consoleUrl({ticket: "T", port: 1216})).toBe(`wss://${window.location.hostname}:1216/?ticket=T`);
    });
});

describe("consoleCertificateUrl", () => {
    test("is the https url of the endpoint, less the ticket", () => {
        expect(consoleCertificateUrl("wss://node1.example.com:1216/?ticket=T")).toBe("https://node1.example.com:1216/");
    });
});

describe("openConsoleSession", () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
    });

    test("receives the terminal bytes, and sends keystrokes and sizes once open", () => {
        const onOpen = vi.fn();
        const onData = vi.fn();
        const session = openConsoleSession("wss://n1:1216/?ticket=T", {onOpen, onData}, FakeWebSocket);
        const ws = FakeWebSocket.instances[0];
        expect(ws.url).toBe("wss://n1:1216/?ticket=T");
        expect(ws.binaryType).toBe("arraybuffer");

        // Nothing is sent before the websocket is open.
        session.send("x");
        session.resize(80, 24);
        expect(ws.sent).toEqual([]);

        ws.open();
        expect(onOpen).toHaveBeenCalledTimes(1);

        session.send("ls\n");
        expect(Array.from(ws.sent[0])).toEqual([108, 115, 10]);
        session.resize(132, 43);
        expect(JSON.parse(ws.sent[1])).toEqual({type: CONSOLE_MSG_RESIZE, cols: 132, rows: 43});

        ws.onmessage({data: new Uint8Array([104, 105]).buffer});
        expect(Array.from(onData.mock.calls[0][0])).toEqual([104, 105]);
    });

    test("reports how the session ended", () => {
        const onEnd = vi.fn();
        openConsoleSession("wss://n1:1216/", {onEnd}, FakeWebSocket);
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.onmessage({data: "not json"});
        ws.onmessage({data: JSON.stringify({type: "other"})});
        ws.onmessage({data: JSON.stringify({type: "exit", code: 3, reason: "exited"})});
        ws.onclose({});
        expect(onEnd).toHaveBeenCalledWith({opened: true, exit: {code: 3, reason: "exited", text: ""}});
    });

    test("reports an exit with no code as code 0", () => {
        const onEnd = vi.fn();
        openConsoleSession("wss://n1:1216/", {onEnd}, FakeWebSocket);
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.onmessage({data: JSON.stringify({type: "exit"})});
        ws.onclose({});
        expect(onEnd).toHaveBeenCalledWith({opened: true, exit: {code: 0, reason: "", text: ""}});
    });

    test("reports a session that never opened, and one that was lost", () => {
        const onEnd = vi.fn();
        openConsoleSession("wss://n1:1216/", {onEnd}, FakeWebSocket);
        let ws = FakeWebSocket.instances[0];
        ws.onerror({});
        ws.onclose({});
        expect(onEnd).toHaveBeenLastCalledWith({opened: false, exit: null});

        openConsoleSession("wss://n1:1216/", {onEnd}, FakeWebSocket);
        ws = FakeWebSocket.instances[1];
        ws.open();
        ws.onclose({});
        expect(onEnd).toHaveBeenLastCalledWith({opened: true, exit: null});
    });

    test("works with no handler, and closes the websocket", () => {
        const session = openConsoleSession("wss://n1:1216/", undefined, FakeWebSocket);
        const ws = FakeWebSocket.instances[0];
        ws.open();
        ws.onmessage({data: new Uint8Array([1]).buffer});
        session.close();
        expect(ws.closed).toBe(true);
    });

    test("uses the WebSocket of the browser by default", () => {
        const original = global.WebSocket;
        global.WebSocket = FakeWebSocket;
        try {
            openConsoleSession("wss://n1:1216/");
            expect(FakeWebSocket.instances).toHaveLength(1);
        } finally {
            global.WebSocket = original;
        }
    });
});
