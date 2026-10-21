import React from "react";
import {render, screen, waitFor, within, fireEvent, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Heartbeats, {linkMatches} from "../Heartbeats";
import {clearGrants} from "../../hooks/useGrants";
import i18n from "../../i18n";
import useEventStore from "../../hooks/useEventStore.js";
import {useActionTracker} from "../../app/action-tracker";
import {vi} from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock("../../hooks/useEventStore.js", () => ({
    __esModule: true,
    default: vi.fn(),
}));

const {mockRetainEventReception, mockReleaseEventReception} = vi.hoisted(() => ({
    mockRetainEventReception: vi.fn(),
    mockReleaseEventReception: vi.fn(),
}));

vi.mock("../../eventSourceManager.jsx", () => ({
    retainEventReception: (...args) => {
        mockRetainEventReception(...args);
        return mockReleaseEventReception;
    },
    startLoggerReception: vi.fn(),
    closeLoggerEventSource: vi.fn(),
}));

const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
};
Object.defineProperty(window, "localStorage", {value: mockLocalStorage});

/**
 * Renders the page, its streams table unfolded (folded by default under the mesh):
 * the tests are about the table. `folded` leaves it as the page opens.
 */
const renderWithRouter = (ui, {route = "/", folded = false} = {}) => {
    const Wrapper = ({children}) => (
        <MemoryRouter initialEntries={[route]}>
            {children}
        </MemoryRouter>
    );
    const result = render(ui, {wrapper: Wrapper});
    const toggle = screen.queryByRole("button", {name: /^(Streams|Flux)/});
    if (!folded && toggle?.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
    return result;
};

const buildStatus = (streamDefs) => {
    const status = {};
    streamDefs.forEach(({node, streams}) => {
        status[node] = {streams: streams.map(s => ({...s}))};
    });
    return status;
};

// The view reads the MUI breakpoints it used through matchMedia: below md (900px) is
// mobile, from lg (1200px) wide.
const MOBILE_QUERY = "(max-width:899.95px)";
const WIDE_QUERY = "(min-width:1200px)";

const setMedia = ({mobile = false, wide = false} = {}) => {
    window.matchMedia = vi.fn((query) => ({
        matches: (query === MOBILE_QUERY && mobile) || (query === WIDE_QUERY && wide),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
    }));
};

const SELECT_LABEL = {running: "Routine", beating: "Beating", node: "Node", id: "ID"};

const getFilter = (selectKey, options) =>
    screen.getByRole("combobox", {name: SELECT_LABEL[selectKey], ...options});

const selectFilterOption = async (user, selectKey, optionName) => {
    const select = getFilter(selectKey);
    await user.selectOptions(select, within(select).getByRole("option", {name: optionName}));
};

const EMPTY_MESSAGE = "No heartbeats found matching the current filters.";

/** The heartbeat rows of the body, without the row telling the table is empty. */
const getDataRows = () =>
    screen.getAllByRole("row").slice(1).filter(row => !row.textContent.includes(EMPTY_MESSAGE));

const getScrollContainer = () => screen.getByRole("table").parentElement;

/** The side of a row from its direction: the node sends on a tx, receives on an rx. */
const sideOf = (cells) => ({"sends to": "tx", "receives from": "rx"})[cells[3]] ?? "";

/** The stream of a row as its id says it, "1.rx": its heartbeat, hb# dropped, and its side. */
const streamOf = (row) => {
    const cells = within(row).getAllByRole("cell").map((c) => c.textContent);
    return `${cells[0].replace(/^hb#/, "")}.${sideOf(cells)}`;
};

const stoppedStreamWithCacheScenario = ({
                                            cachedPeer = {
                                                is_beating: true,
                                                desc: ":10011 ← peer1",
                                                changed_at: "t1",
                                                last_beating_at: "t2"
                                            },
                                            cachedType = "unicast",
                                            stoppedType = "unicast",
                                        } = {}) => {
    const initialStatus = buildStatus([{
        node: "node1",
        streams: [{
            id: "hb#1.rx",
            state: "running",
            type: cachedType,
            peers: {peer1: cachedPeer}
        }]
    }]);
    const stoppedStatus = buildStatus([{
        node: "node1",
        streams: [{id: "hb#1.rx", state: "stopped", type: stoppedType, peers: {}}]
    }]);
    return {initialStatus, stoppedStatus};
};

describe("Heartbeats Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue("valid-token");
        mockNavigate.mockClear();
        setMedia();
        useActionTracker.setState({tracked: [], revealed: 0});
        storeListeners.clear();
    });

    afterEach(() => {
        delete window.matchMedia;
    });

    // The store as the page and the actions tray read it: selected, read, and listened to.
    let storeState = {heartbeatStatus: {}};
    const storeListeners = new Set();
    const mockHeartbeatStore = (heartbeatStatus) => {
        storeState = {heartbeatStatus};
        useEventStore.mockImplementation((selector) => selector(storeState));
        useEventStore.getState = () => storeState;
        useEventStore.subscribe = (listener) => {
            storeListeners.add(listener);
            return () => storeListeners.delete(listener);
        };
    };
    /** The status the events bring next, heard by the listeners. */
    const pushHeartbeatStatus = (heartbeatStatus) => act(() => {
        storeState = {heartbeatStatus};
        storeListeners.forEach((listener) => listener(storeState));
    });
    /** What the actions tray holds, the latest first: label, subject, state, reason. */
    const tray = () => useActionTracker.getState().tracked.map((e) => [e.label, e.subject, e.state, e.error ?? null]);

    // ==================== STRUCTURE & BASIC RENDER ====================
    test("renders table structure and basic heartbeat rows", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {
                    id: "hb#1.rx", state: "running", type: "unicast",
                    peers: {peer1: {is_beating: true, desc: ":10011 ← peer1"}}
                },
                {
                    id: "hb#2.rx", state: "stopped", type: "unicast",
                    peers: {peer2: {is_beating: false, desc: ":10012 ← peer2"}}
                },
            ],
        }]));

        renderWithRouter(<Heartbeats/>);

        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();
        const headerRow = within(table).getByRole("row", {name: /Heartbeat Type Node Direction Peer Desc Routine Beating Since Last Beat/i});
        ["Heartbeat", "Type", "Node", "Direction", "Peer", "Desc", "Routine", "Beating", "Since", "Last Beat"].forEach(text =>
            expect(within(headerRow).getByText(text)).toBeInTheDocument()
        );

        ["Heartbeat", "Type", "Node", "Direction", "Peer", "Desc", "Routine", "Beating", "Since", "Last Beat"].forEach(name =>
            expect(within(headerRow).getByRole("button", {name})).toBeInTheDocument()
        );
        // Sorted by node, ascending, at first.
        expect(within(headerRow).getByRole("columnheader", {name: "Node"})).toHaveAttribute("aria-sort", "ascending");
        expect(within(headerRow).getByRole("columnheader", {name: "Heartbeat"})).toHaveAttribute("aria-sort", "none");

        const dataRows = getDataRows();
        expect(dataRows).toHaveLength(2);
        expect(streamOf(dataRows[0])).toBe("1.rx");
        expect(streamOf(dataRows[1])).toBe("2.rx");
        expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    });

    test("speaks French to a French browser", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "running", type: "unicast", peers: {}}],
        }]));
        await i18n.changeLanguage("fr");
        try {
            renderWithRouter(<Heartbeats/>);
            expect(screen.getByRole("columnheader", {name: "Dernier battement"})).toBeInTheDocument();
            expect(screen.getByText("Aucun heartbeat ne correspond aux filtres actuels.")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    // ==================== STATE ICONS ====================
    test.each([
        ["running", "started", "up", "text-ink"],
        ["warning", "warning", "warn", "text-state-warn"],
        ["stopped", "stopped", "down", "text-state-down"],
        ["failed", "failed", "down", "text-state-down"],
        ["unknown", "unknown", "unknown", "text-state-unknown"],
        ["invalid-state", "invalid-state", "unknown", "text-state-unknown"],
    ])("renders the %s routine as %s in the %s tint", async (state, word, status, ink) => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state, type: "unicast", peers: {p: {is_beating: true, desc: "d"}}}],
        }]));
        renderWithRouter(<Heartbeats/>);
        const stateCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[6];
        const mark = within(stateCell).getByText(word);
        expect(mark).toHaveAttribute("data-state", status);
        expect(mark).toHaveClass(ink);
    });

    test("keeps the dates on one line", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {p: {is_beating: true, desc: "d", changed_at: "2025-06-03T04:25:31+00:00", last_beating_at: "2025-06-03T04:25:32+00:00"}},
            }],
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[8]).toHaveClass("whitespace-nowrap");
        expect(cells[9]).toHaveClass("whitespace-nowrap");
    });

    // ==================== BEATING ICON ====================
    test("renders the down status dot for a stale heartbeat in multi-node", async () => {
        mockHeartbeatStore(buildStatus([
            {
                node: "node1",
                streams: [{
                    id: "hb#1.rx", state: "running", type: "unicast",
                    peers: {peer1: {is_beating: false, desc: "desc1"}}
                }]
            },
            {
                node: "node2",
                streams: [{
                    id: "hb#2.rx", state: "running", type: "unicast",
                    peers: {peer2: {is_beating: true, desc: "desc2"}}
                }]
            }
        ]));
        renderWithRouter(<Heartbeats/>);
        const rows = getDataRows();
        const staleRow = rows.find(row => streamOf(row) === "1.rx");
        expect(staleRow).toBeInTheDocument();
        const beatingCell = within(staleRow).getAllByRole("cell")[7];
        const mark = within(beatingCell).getByText("Stale");
        expect(mark).toHaveAttribute("data-state", "down");
        expect(mark).toHaveClass("text-state-down");
        const beatingRow = rows.find(row => streamOf(row) === "2.rx");
        expect(within(within(beatingRow).getAllByRole("cell")[7]).getByText("Beating"))
            .toHaveAttribute("data-state", "up");
    });

    test("single node always shows healthy beating icon", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {
                    peer1: {
                        is_beating: false, desc: ":10011 ← peer1",
                        changed_at: "2025-06-03T04:25:31+00:00",
                        last_beating_at: "2025-06-03T04:25:31+00:00"
                    }
                }
            }]
        }]));
        renderWithRouter(<Heartbeats/>);
        const beatingCell = within(screen.getAllByRole("row")[1]).getAllByRole("cell")[7];
        const mark = within(beatingCell).getByText("Healthy (single node)");
        expect(mark).toHaveAttribute("data-state", "up");
    });

    // ==================== FILTERS FROM URL ====================
    const filterStreams = [
        {
            id: "hb#1.rx", state: "running", type: "unicast",
            peers: {
                peer1: {
                    is_beating: true, desc: ":10011 ← peer1",
                    changed_at: "2025-06-03T04:25:31+00:00",
                    last_beating_at: "2025-06-03T04:25:31+00:00"
                }
            }
        },
        {
            id: "hb#2.rx", state: "stopped", type: "unicast",
            peers: {
                peer2: {
                    is_beating: false, desc: ":10012 ← peer2",
                    changed_at: "2025-06-03T04:25:31+00:00",
                    last_beating_at: "2025-06-03T04:25:31+00:00"
                }
            }
        },
    ];

    test.each([
        ["/?status=stale", 1, "2.rx"],
        ["/?status=beating", 1, "1.rx"],
        ["/?node=node1", 2, "1.rx"],
        ["/?state=stopped", 1, "2.rx"],
        ["/?id=1.rx", 1, "1.rx"],
        ["/?id=hb%231.rx", 1, "1.rx"],
        ["/?id=3.tx", 0, null],
    ])("filter from URL %s", async (route, expectedLength, expectedText) => {
        mockHeartbeatStore(buildStatus([{node: "node1", streams: filterStreams}]));
        renderWithRouter(<Heartbeats/>, {route});

        const dataRows = getDataRows();
        expect(dataRows).toHaveLength(expectedLength);
        if (expectedText) {
            expect(streamOf(dataRows[0])).toBe(expectedText);
        } else {
            expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
        }
    });

    test("filter by id with .tx suffix", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#3.tx", state: "running", type: "unicast",
                peers: {
                    peer3: {
                        is_beating: true, desc: ":10013 ← peer3",
                        changed_at: "2025-06-03T04:25:31+00:00",
                        last_beating_at: "2025-06-03T04:25:31+00:00"
                    }
                }
            }]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?id=3.tx"});
        expect(getDataRows()).toHaveLength(1);
        expect(getDataRows().map(streamOf)).toContain("3.tx");
    });

    test("filter by id without hb# prefix and without rx/tx suffix", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#5.rx", state: "running", type: "unicast",
                peers: {p: {is_beating: true, desc: "d", changed_at: "t", last_beating_at: "t"}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?id=5"});
        expect(getDataRows()).toHaveLength(1);
        expect(getDataRows().map(streamOf)).toContain("5.rx");
    });

    test("invalid status defaults to all", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {
                    peer1: {
                        is_beating: true, desc: ":10011 ← peer1",
                        changed_at: "2025-06-03T04:25:31+00:00",
                        last_beating_at: "2025-06-03T04:25:31+00:00"
                    }
                }
            }]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?status=invalid"});
        await waitFor(() => expect(getDataRows().map(streamOf)).toContain("1.rx"));
    });

    test("does not update URL if filter unchanged", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "running", peers: {}, type: "t"}]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?node=node1"});
        await waitFor(() => {
        }, {timeout: 500});
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("updates URL and rows when node filter changes", async () => {
        const user = userEvent.setup();
        mockHeartbeatStore(buildStatus([
            {
                node: "node1",
                streams: [{
                    id: "hb#1.rx", state: "running", type: "unicast",
                    peers: {peer1: {is_beating: true, desc: "desc1"}}
                }]
            },
            {
                node: "node2",
                streams: [{
                    id: "hb#2.rx", state: "running", type: "unicast",
                    peers: {peer2: {is_beating: true, desc: "desc2"}}
                }]
            }
        ]));
        renderWithRouter(<Heartbeats/>);

        expect(getDataRows()).toHaveLength(2);
        await selectFilterOption(user, "node", "node2");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/?node=node2", {replace: true});
        }, {timeout: 1500});

        const rows = getDataRows();
        expect(rows).toHaveLength(1);
        expect(streamOf(rows[0])).toBe("2.rx");
    });

    test("changes state filter via UI and updates URL", async () => {
        const user = userEvent.setup();
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "hb#1.rx", state: "running", type: "t", peers: {p1: {is_beating: true, desc: "d1"}}},
                {id: "hb#2.rx", state: "stopped", type: "t", peers: {p2: {is_beating: false, desc: "d2"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>);

        await selectFilterOption(user, "running", "stopped");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/?state=stopped", {replace: true});
        }, {timeout: 1500});
    });

    test("changes beating filter via UI and updates URL", async () => {
        const user = userEvent.setup();
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "hb#1.rx", state: "running", type: "t", peers: {p1: {is_beating: true, desc: "d1"}}},
                {id: "hb#2.rx", state: "running", type: "t", peers: {p2: {is_beating: false, desc: "d2"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>);

        await selectFilterOption(user, "beating", "Beating");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/?status=beating", {replace: true});
        }, {timeout: 1500});

        const rows = getDataRows();
        expect(rows).toHaveLength(1);
        expect(streamOf(rows[0])).toBe("1.rx");
    });

    test("changes id filter via UI and updates URL", async () => {
        const user = userEvent.setup();
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "hb#1.rx", state: "running", type: "t", peers: {p1: {is_beating: true, desc: "d1"}}},
                {id: "hb#2.rx", state: "running", type: "t", peers: {p2: {is_beating: true, desc: "d2"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>);

        await selectFilterOption(user, "id", "2");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/?id=2", {replace: true});
        }, {timeout: 1500});
    });

    test("clears URL when all filters are reset to all", async () => {
        const user = userEvent.setup();
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "t",
                peers: {p: {is_beating: true, desc: "d"}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?node=node1"});

        await selectFilterOption(user, "node", "All");

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/", {replace: true});
        }, {timeout: 1500});
    });

    test("multiple URL filters apply together", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "hb#1.rx", state: "running", type: "t", peers: {p1: {is_beating: true, desc: "d1"}}},
                {id: "hb#2.rx", state: "stopped", type: "t", peers: {p2: {is_beating: false, desc: "d2"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?status=beating&node=node1&state=running&id=1"});
        const rows = getDataRows();
        expect(rows).toHaveLength(1);
        expect(streamOf(rows[0])).toBe("1.rx");
    });

    // ==================== EDGE CASES: STOPPED STREAMS & CACHE ====================
    test("handles stopped stream with cached peers", async () => {
        const {initialStatus, stoppedStatus} = stoppedStreamWithCacheScenario();

        useEventStore.mockImplementation(selector => selector({heartbeatStatus: initialStatus}));
        const {rerender} = renderWithRouter(<Heartbeats/>);

        let cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[4]).toHaveTextContent("peer1");

        useEventStore.mockImplementation(selector => selector({heartbeatStatus: stoppedStatus}));
        rerender(<Heartbeats/>);
        await waitFor(() => {
            const updatedCells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
            expect(updatedCells[4]).toHaveTextContent("peer1");
            expect(updatedCells[5]).toHaveTextContent(":10011 ← peer1");
        }, {timeout: 2000});
    });

    test("displays N/A for stopped stream with no cached peers", async () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "stopped", type: "unicast", peers: {}}]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[4]).toHaveTextContent("N/A");
        expect(cells[1]).toHaveTextContent("unicast");
        expect(cells[5]).toHaveTextContent("N/A");
        expect(cells[8]).toHaveTextContent(/^-$/);
        expect(cells[9]).toHaveTextContent(/^-$/);
    });

    test("stopped stream with no cache and null type falls back to N/A", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "stopped", type: null, peers: {}}]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[1]).toHaveTextContent("N/A");
    });

    test("stopped stream with cached peer missing fields shows a dash in timestamp columns", async () => {
        const {initialStatus, stoppedStatus} = stoppedStreamWithCacheScenario({
            cachedPeer: {is_beating: true}, // no desc, no changed_at, no last_beating_at
        });

        useEventStore.mockImplementation(selector => selector({heartbeatStatus: initialStatus}));
        const {rerender} = renderWithRouter(<Heartbeats/>);
        useEventStore.mockImplementation(selector => selector({heartbeatStatus: stoppedStatus}));
        rerender(<Heartbeats/>);

        await waitFor(() => {
            const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
            expect(cells[5]).toHaveTextContent("N/A");
            expect(cells[8]).toHaveTextContent(/^-$/);
            expect(cells[9]).toHaveTextContent(/^-$/);
        }, {timeout: 2000});
    });

    test("stopped stream without peers field", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "stopped", type: "unicast"}]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[4]).toHaveTextContent("N/A");
    });

    test("running stream without peers field produces no rows", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{id: "hb#1.rx", state: "running", type: "unicast"}]
        }]));
        renderWithRouter(<Heartbeats/>);
        expect(getDataRows()).toHaveLength(0);
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });

    // ==================== EMPTY / MISSING DATA ====================
    test("handles empty or null streams", () => {
        mockHeartbeatStore({node1: {streams: []}, node2: {streams: null}});
        renderWithRouter(<Heartbeats/>);
        expect(getDataRows()).toHaveLength(0);
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });

    test("shows message when no heartbeats match filters", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running",
                peers: {peer1: {is_beating: true, desc: "desc"}},
                type: "unicast"
            }]
        }]));
        renderWithRouter(<Heartbeats/>, {route: "/?node=nonexistent"});
        expect(screen.getByRole("cell", {name: EMPTY_MESSAGE})).toHaveAttribute("colspan", "10");
    });

    test("stream without state does not add empty entry to available states", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "hb#1.rx", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>);
        const options = within(getFilter("running")).getAllByRole("option");
        expect(options.map(o => o.value)).toEqual(["all"]);
    });

    test("stream with id 'all' is skipped by availableIds", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [
                {id: "all", state: "running", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}},
                {id: "hb#1.rx", state: "running", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}}
            ]
        }]));
        renderWithRouter(<Heartbeats/>);
        // The four filters, and the page size.
        expect(screen.getAllByRole("combobox")).toHaveLength(5);
        const ids = within(getFilter("id")).getAllByRole("option").map(o => o.value);
        expect(ids).toEqual(["all", "1"]);
    });

    test("empty string peer key shows N/A for peer", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {"": {is_beating: true, desc: "d", changed_at: "t", last_beating_at: "t"}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[4]).toHaveTextContent("N/A");
    });

    test("times show as the nodes table shows them: their age, the full date on hover", () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {peer1: {is_beating: true, changed_at: twoHoursAgo, last_beating_at: twoHoursAgo}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[8]).toHaveTextContent("2h ago");
        expect(within(cells[9]).getByText("2h ago")).toHaveAttribute("title", new Date(twoHoursAgo).toLocaleString(i18n.language));
    });

    test("peer without desc/changed_at/last_beating_at shows N/A", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx", state: "running", type: "unicast",
                peers: {peer1: {}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[5]).toHaveTextContent("N/A");
        expect(cells[8]).toHaveTextContent(/^-$/);
        expect(cells[9]).toHaveTextContent(/^-$/);
    });

    test("stream without type or state falls back to N/A and unknown", () => {
        mockHeartbeatStore(buildStatus([{
            node: "node1",
            streams: [{
                id: "hb#1.rx",
                peers: {peer1: {is_beating: true, desc: "d", changed_at: "t", last_beating_at: "t"}}
            }]
        }]));
        renderWithRouter(<Heartbeats/>);
        const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
        expect(cells[1]).toHaveTextContent("N/A");
        expect(within(cells[6]).getByText("unknown")).toHaveAttribute("data-state", "unknown");
    });

    // ==================== SORTING ====================
    const sortTestData = [
        ["id", "Heartbeat", "a.rx", "b.rx"],
        ["peer", "Peer", "a_peer", "b_peer"],
        ["type", "Type", "a_type", "b_type"],
        ["desc", "Desc", "a_desc", "b_desc"],
        ["changed_at", "Since", "2024-01-01", "2024-02-01"],
        ["last_beating_at", "Last Beat", "2024-01-01", "2024-02-01"],
    ];

    test.each(sortTestData)("sorts by %s column", async (key, headerText, ascValue, descValue) => {
        const status = {
            node1: {
                streams: [
                    {
                        id: key === "id" ? "hb#b.rx" : "hb#1.rx",
                        state: "running",
                        peers: {
                            [key === "peer" ? "b_peer" : "peer1"]: {
                                is_beating: true,
                                desc: key === "desc" ? "b_desc" : "desc1",
                                changed_at: key === "changed_at" ? "2024-02-01" : "2024-01-01",
                                last_beating_at: key === "last_beating_at" ? "2024-02-01" : "2024-01-01",
                            },
                        },
                        type: key === "type" ? "b_type" : "type1",
                    },
                    {
                        id: key === "id" ? "hb#a.rx" : "hb#2.rx",
                        state: "running",
                        peers: {
                            [key === "peer" ? "a_peer" : "peer2"]: {
                                is_beating: true,
                                desc: key === "desc" ? "a_desc" : "desc2",
                                changed_at: key === "changed_at" ? "2024-01-01" : "2024-01-02",
                                last_beating_at: key === "last_beating_at" ? "2024-01-01" : "2024-01-02",
                            },
                        },
                        type: key === "type" ? "a_type" : "type2",
                    },
                ],
            },
        };
        mockHeartbeatStore(status);
        renderWithRouter(<Heartbeats/>);
        // A time older than a week shows as its date, as the nodes table shows it.
        const shown = (v) => key.endsWith("_at") ? new Date(v).toLocaleDateString(i18n.language) : v;
        ascValue = shown(ascValue);
        descValue = shown(descValue);

        const header = screen.getByRole("button", {name: headerText});
        await userEvent.click(header);
        expect(header.closest("th")).toHaveAttribute("aria-sort", "ascending");
        // The id is the heartbeat and the side of the row, in two cells.
        const shows = (row, value) => key === "id"
            ? expect(streamOf(row)).toBe(value)
            : expect(within(row).getByText(value)).toBeInTheDocument();
        let rows = getDataRows();
        shows(rows[0], ascValue);
        shows(rows[1], descValue);

        await userEvent.click(header);
        expect(header.closest("th")).toHaveAttribute("aria-sort", "descending");
        rows = getDataRows();
        shows(rows[0], descValue);
        shows(rows[1], ascValue);
    });

    test("sorts by beating column", async () => {
        mockHeartbeatStore({
            node1: {
                streams: [
                    {id: "hb#1.rx", state: "running", peers: {peer1: {is_beating: true, desc: "desc1"}}, type: "type1"},
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {peer2: {is_beating: false, desc: "desc2"}},
                        type: "type2"
                    },
                ],
            },
        });
        renderWithRouter(<Heartbeats/>);

        const beatingHeader = screen.getByRole("button", {name: "Beating"});
        await userEvent.click(beatingHeader);
        let rows = getDataRows();
        expect(streamOf(rows[0])).toBe("2.rx");
        expect(streamOf(rows[1])).toBe("1.rx");

        await userEvent.click(beatingHeader);
        rows = getDataRows();
        expect(streamOf(rows[0])).toBe("1.rx");
        expect(streamOf(rows[1])).toBe("2.rx");
    });

    test("sorting by state column", async () => {
        const states = ["running", "warning", "stopped", "failed", "unknown"];
        const status = {
            node1: {
                streams: states.map((s, i) => ({
                    id: `hb#${i + 1}.rx`,
                    state: s,
                    peers: {peer: {is_beating: false, desc: `desc${i + 1}`}},
                    type: `type${i + 1}`,
                })),
            },
        };
        mockHeartbeatStore(status);
        renderWithRouter(<Heartbeats/>);

        const stateHeader = screen.getByRole("button", {name: "Routine"});
        await userEvent.click(stateHeader);
        let rows = getDataRows();
        ["5.rx", "4.rx", "3.rx", "2.rx", "1.rx"].forEach((id, idx) =>
            expect(streamOf(rows[idx])).toBe(id)
        );

        await userEvent.click(stateHeader);
        rows = getDataRows();
        ["1.rx", "2.rx", "3.rx", "4.rx", "5.rx"].forEach((id, idx) =>
            expect(streamOf(rows[idx])).toBe(id)
        );
    });

    test("sorting different column resets direction to asc", async () => {
        mockHeartbeatStore({
            node1: {
                streams: [
                    {id: "hb#b.rx", state: "running", peers: {p: {is_beating: true}}, type: "t"},
                    {id: "hb#a.rx", state: "running", peers: {p: {is_beating: true}}, type: "t"},
                ],
            },
        });
        renderWithRouter(<Heartbeats/>);

        const beatingHeader = screen.getByRole("button", {name: "Beating"});
        await userEvent.click(beatingHeader);
        await userEvent.click(beatingHeader);
        await userEvent.click(screen.getByRole("button", {name: "Heartbeat"}));
        const rows = getDataRows();
        expect(streamOf(rows[0])).toBe("a.rx");
    });

    test("third click on same header toggles direction back to ascending", async () => {
        mockHeartbeatStore({
            node1: {
                streams: [
                    {id: "hb#b.rx", state: "running", peers: {p: {is_beating: true}}, type: "t"},
                    {id: "hb#a.rx", state: "running", peers: {p: {is_beating: true}}, type: "t"},
                ],
            },
        });
        renderWithRouter(<Heartbeats/>);

        const idHeader = screen.getByRole("button", {name: "Heartbeat"});
        await userEvent.click(idHeader); // asc
        await userEvent.click(idHeader); // desc
        await userEvent.click(idHeader); // back to asc
        const rows = getDataRows();
        expect(streamOf(rows[0])).toBe("a.rx");
        expect(streamOf(rows[1])).toBe("b.rx");
    });

    test("sorts by node column", async () => {
        mockHeartbeatStore(buildStatus([
            {
                node: "nodeB",
                streams: [{id: "hb#1.rx", state: "running", type: "t", peers: {p: {is_beating: true, desc: "d"}}}]
            },
            {
                node: "nodeA",
                streams: [{id: "hb#2.rx", state: "running", type: "t", peers: {p: {is_beating: true, desc: "d"}}}]
            },
        ]));
        renderWithRouter(<Heartbeats/>);
        let rows = getDataRows();
        expect(within(rows[0]).getByText("nodeA")).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", {name: "Node"}));
        rows = getDataRows();
        expect(within(rows[0]).getByText("nodeB")).toBeInTheDocument();
    });

    // ==================== MULTIPLE NODES & SINGLE NODE ====================
    test("handles multiple nodes and ordering", async () => {
        mockHeartbeatStore(buildStatus([
            {
                node: "nodeB",
                streams: [{
                    id: "hb#2.rx", state: "running", type: "unicast",
                    peers: {
                        peer2: {
                            is_beating: true, desc: ":10012 ← peer2",
                            changed_at: "2025-06-03T04:25:31+00:00",
                            last_beating_at: "2025-06-03T04:25:31+00:00"
                        }
                    }
                }]
            },
            {
                node: "nodeA",
                streams: [{
                    id: "hb#1.rx", state: "running", type: "unicast",
                    peers: {
                        peer1: {
                            is_beating: true, desc: ":10011 ← peer1",
                            changed_at: "2025-06-03T04:25:31+00:00",
                            last_beating_at: "2025-06-03T04:25:31+00:00"
                        }
                    }
                }]
            },
        ]));
        renderWithRouter(<Heartbeats/>);
        const dataRows = getDataRows();
        expect(dataRows).toHaveLength(2);
        expect(within(dataRows[0]).getByText("nodeA")).toBeInTheDocument();
        expect(within(dataRows[1]).getByText("nodeB")).toBeInTheDocument();
    });

    // ==================== AUTH & CLEANUP ====================
    test("initializes with auth token and cleans up on unmount", () => {
        mockHeartbeatStore({});
        const {unmount} = renderWithRouter(<Heartbeats/>);
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith("authToken");
        expect(mockRetainEventReception).toHaveBeenCalledWith("valid-token", expect.any(Array));
        unmount();
        expect(mockReleaseEventReception).toHaveBeenCalled();
    });

    test("does not start event reception without auth token", () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        mockHeartbeatStore({});
        renderWithRouter(<Heartbeats/>);
        expect(mockRetainEventReception).not.toHaveBeenCalled();
    });

    // ==================== MESH LINES AND STREAM ACTIONS ====================
    const TWO_NODES = () => buildStatus([
        {node: "n1", streams: [
            {id: "hb#1.tx", state: "running", type: "unicast", peers: {n2: {is_beating: true, desc: "→ n2"}}},
            {id: "hb#1.rx", state: "running", type: "unicast", peers: {n2: {is_beating: true, desc: "← n2"}}},
        ]},
        {node: "n2", streams: [
            {id: "hb#1.tx", state: "stopped", type: "unicast", peers: {n1: {is_beating: false, desc: "→ n1"}}},
            {id: "hb#1.rx", state: "running", type: "unicast", peers: {n1: {is_beating: true, desc: "← n1"}}},
        ]},
    ]);

    /** A status with a stream of a node changed, as the events bring it. */
    const withStream = (status, node, id, change) => ({
        ...status,
        [node]: {...status[node], streams: status[node].streams.map((s) => (s.id === id ? {...s, ...change} : s))},
    });

    /** The API: whoami saying the grants given, the stream actions answered ok. */
    const mockApi = (grant) => {
        clearGrants();
        const calls = [];
        global.fetch = vi.fn(async (url, options = {}) => {
            calls.push({url, method: options.method ?? "GET"});
            if (url === "/api/auth/whoami") return {ok: true, json: async () => ({grant})};
            return {ok: true, json: async () => ({})};
        });
        return calls;
    };

    test("a link is the sender's tx and the receiver's rx between its two nodes", () => {
        expect(linkMatches("n1>n2", {node: "n1", id: "hb#1.tx", peer: "n2"})).toBe(true);
        expect(linkMatches("n1>n2", {node: "n2", id: "hb#1.rx", peer: "n1"})).toBe(true);
        expect(linkMatches("n1>n2", {node: "n1", id: "hb#1.rx", peer: "n2"})).toBe(false);
        expect(linkMatches("n1>n2", {node: "n2", id: "hb#1.tx", peer: "n1"})).toBe(false);
        expect(linkMatches("", {node: "n2", id: "hb#1.tx", peer: "n1"})).toBe(true);
        // A stopped tx of the sender reports no peer: kept, it is the cause of a failing link.
        expect(linkMatches("n1>n2", {node: "n1", id: "4.tx", peer: "N/A", peerUnknown: true})).toBe(true);
        expect(linkMatches("n1>n2", {node: "n2", id: "4.tx", peer: "N/A", peerUnknown: true})).toBe(false);
    });

    test("a line of the mesh clicked unfolds the streams, filtered to its links, other filters cleared", async () => {
        mockApi({});
        mockHeartbeatStore(TWO_NODES());
        const {container} = renderWithRouter(<Heartbeats/>, {route: "/heartbeats?node=n2", folded: true});
        fireEvent.click(screen.getByRole("button", {name: /^Streams/}));
        expect(screen.getByRole("button", {name: /^Streams/})).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(container.querySelector('[data-group="n1 n2"]'));
        expect(screen.getByRole("button", {name: /^Streams/})).toHaveAttribute("aria-expanded", "true");
        // n1 tx toward n2, n2 rx from n1: two rows, whatever the node filter was.
        expect(getDataRows().map((row) => [streamOf(row), ...[2, 4].map((i) => within(row).getAllByRole("cell")[i].textContent)]))
            .toEqual(expect.arrayContaining([["1.tx", "n1", "n2"], ["1.rx", "n2", "n1"]]));
        expect(getDataRows()).toHaveLength(2);
        expect(getFilter("node")).toHaveValue("all");
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("link=n1%3En2"), {replace: true}));
        // The chip of the link removes its filter.
        fireEvent.click(screen.getByRole("button", {name: "Remove the n1 → n2 filter"}));
        expect(getDataRows()).toHaveLength(4);
    });

    test("root selects streams and starts, stops or restarts them, stop and restart confirmed first", async () => {
        const calls = mockApi({root: null});
        mockHeartbeatStore(TWO_NODES());
        renderWithRouter(<Heartbeats/>);
        const select = (id, node) => screen.getByRole("checkbox", {name: `Select the ${id} stream of ${node}`});
        await waitFor(() => expect(select("1.tx", "n1")).toBeInTheDocument());
        const posts = () => calls.filter((c) => c.method === "POST").map((c) => c.url);
        // Nothing selected: how to act, in the place of the actions.
        expect(screen.getByText("Select streams to start, stop or restart them")).toBeInTheDocument();
        // The routine is a word: the actions are the menu's.
        expect(screen.getAllByText("started").length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", {name: /started/})).not.toBeInTheDocument();

        // A started stream: nothing to start; stop confirmed, naming the stream.
        fireEvent.click(select("1.tx", "n1"));
        expect(screen.getByText("1 selected")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Actions"}));
        let menu = await screen.findByRole("menu");
        expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Start", "Stop", "Restart"]);
        expect(within(menu).getByRole("menuitem", {name: "Start"})).toBeDisabled();
        fireEvent.click(within(menu).getByRole("menuitem", {name: "Stop"}));
        let dialog = screen.getByRole("dialog", {name: "Stop a heartbeat stream"});
        expect(dialog).toHaveTextContent("the 1.tx stream of n1");
        expect(posts()).toEqual([]);
        fireEvent.click(within(dialog).getByRole("button", {name: "Stop"}));
        await waitFor(() => expect(posts()).toEqual(["/api/node/name/n1/daemon/hb/name/1.tx/action/stop"]));
        // Queued by the daemon: followed in the actions tray until the stream is seen stopped.
        await waitFor(() => expect(tray()).toEqual([["Stop", "the 1.tx stream of n1", "running", null]]));
        expect(screen.queryByText(/requested/)).not.toBeInTheDocument();
        pushHeartbeatStatus(withStream(TWO_NODES(), "n1", "hb#1.tx", {state: "stopped"}));
        expect(tray()).toEqual([["Stop", "the 1.tx stream of n1", "succeeded", null]]);
        pushHeartbeatStatus(TWO_NODES());
        // Done, the selection is cleared.
        expect(select("1.tx", "n1")).not.toBeChecked();

        // Two streams restarted, confirmed; a cancel posts nothing.
        fireEvent.click(select("1.tx", "n1"));
        fireEvent.click(select("1.rx", "n2"));
        fireEvent.click(screen.getByRole("button", {name: "Actions"}));
        menu = await screen.findByRole("menu");
        fireEvent.click(within(menu).getByRole("menuitem", {name: "Restart"}));
        dialog = screen.getByRole("dialog", {name: "Restart 2 heartbeat streams"});
        fireEvent.click(within(dialog).getByRole("button", {name: "Cancel"}));
        expect(posts()).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", {name: "Actions"}));
        menu = await screen.findByRole("menu");
        fireEvent.click(within(menu).getByRole("menuitem", {name: "Restart"}));
        fireEvent.click(within(screen.getByRole("dialog", {name: "Restart 2 heartbeat streams"})).getByRole("button", {name: "Restart"}));
        await waitFor(() => expect(posts().slice(1)).toEqual([
            "/api/node/name/n1/daemon/hb/name/1.tx/action/restart",
            "/api/node/name/n2/daemon/hb/name/1.rx/action/restart",
        ]));
        await waitFor(() => expect(tray().slice(0, 2).map(([, subject, state]) => [subject, state])).toEqual(expect.arrayContaining([
            ["the 1.tx stream of n1", "running"],
            ["the 1.rx stream of n2", "running"],
        ])));
        // Restarted: running again, created anew.
        pushHeartbeatStatus(withStream(TWO_NODES(), "n1", "hb#1.tx", {created_at: "2026-10-19T12:00:00Z"}));
        expect(tray().filter(([, , state]) => state === "succeeded").map(([, subject]) => subject)).toContain("the 1.tx stream of n1");
        expect(tray().find(([, subject]) => subject === "the 1.rx stream of n2")[2]).toBe("running");

        // A stopped stream starts at once, without confirmation.
        fireEvent.click(select("1.tx", "n2"));
        fireEvent.click(screen.getByRole("button", {name: "Actions"}));
        menu = await screen.findByRole("menu");
        expect(within(menu).getByRole("menuitem", {name: "Stop"})).toBeDisabled();
        fireEvent.click(within(menu).getByRole("menuitem", {name: "Start"}));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await waitFor(() => expect(posts()).toContain("/api/node/name/n2/daemon/hb/name/1.tx/action/start"));
    });

    test("a stream never seen in the state asked: its outcome unknown after a while", async () => {
        mockApi({root: null});
        mockHeartbeatStore(TWO_NODES());
        renderWithRouter(<Heartbeats/>);
        const select = (id, node) => screen.getByRole("checkbox", {name: `Select the ${id} stream of ${node}`});
        await waitFor(() => expect(select("1.tx", "n2")).toBeInTheDocument());
        fireEvent.click(select("1.tx", "n2"));
        vi.useFakeTimers();
        try {
            fireEvent.click(screen.getByRole("button", {name: "Actions"}));
            fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", {name: "Start"}));
            await act(async () => {
                await vi.advanceTimersByTimeAsync(0);
            });
            expect(tray()).toEqual([["Start", "the 1.tx stream of n2", "running", null]]);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(60_000);
            });
            expect(tray()).toEqual([["Start", "the 1.tx stream of n2", "unknown", "no news of it within 60 s"]]);
        } finally {
            vi.useRealTimers();
        }
    });

    test("a stream refused is said in the actions tray with the daemon's reason, the selection kept", async () => {
        clearGrants();
        global.fetch = vi.fn(async (url, options = {}) => {
            if (url === "/api/auth/whoami") return {ok: true, json: async () => ({grant: {root: null}})};
            if (options.method === "POST" && url.includes("/n2/")) {
                return {ok: false, status: 500, headers: new Headers({"content-type": "application/json"}),
                    json: async () => ({detail: "boom"}), text: async () => JSON.stringify({detail: "boom"})};
            }
            return {ok: true, json: async () => ({})};
        });
        mockHeartbeatStore(TWO_NODES());
        renderWithRouter(<Heartbeats/>);
        const select = (id, node) => screen.getByRole("checkbox", {name: `Select the ${id} stream of ${node}`});
        await waitFor(() => expect(select("1.rx", "n1")).toBeInTheDocument());
        fireEvent.click(select("1.rx", "n1"));
        fireEvent.click(select("1.rx", "n2"));
        fireEvent.click(screen.getByRole("button", {name: "Actions"}));
        fireEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem", {name: "Stop"}));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", {name: "Stop"}));
        await waitFor(() => expect(tray()).toHaveLength(2));
        expect(tray()).toEqual(expect.arrayContaining([
            ["Stop", "the 1.rx stream of n1", "running", null],
            ["Stop", "the 1.rx stream of n2", "refused", "HTTP 500 boom"],
        ]));
        // One refused: the selection stays, to try again.
        expect(select("1.rx", "n2")).toBeChecked();
    });

    test("an orange line clicked shows the stopped tx of its sender, which reports no peer", async () => {
        mockApi({});
        mockHeartbeatStore(buildStatus([
            {node: "dev3n1", streams: [
                {id: "hb#4.tx", state: "stopped", type: "unicast", peers: {}},
                {id: "hb#4.rx", state: "running", type: "unicast", peers: {dev3n2: {is_beating: true, desc: "← dev3n2"}}},
            ]},
            {node: "dev3n2", streams: [
                {id: "hb#4.rx", state: "running", type: "unicast", peers: {dev3n1: {is_beating: false, desc: ":10009 ← dev3n1"}}},
                {id: "hb#4.tx", state: "running", type: "unicast", peers: {dev3n1: {is_beating: true, desc: "→ dev3n1"}}},
            ]},
        ]));
        const {container} = renderWithRouter(<Heartbeats/>, {folded: true});
        const line = container.querySelector('[data-group="dev3n1 dev3n2"]');
        expect(line).toHaveAttribute("data-state", "down");
        fireEvent.click(line);
        const shown = getDataRows().map((r) => [streamOf(r), within(r).getAllByRole("cell")[2].textContent]);
        expect(shown).toEqual(expect.arrayContaining([["4.tx", "dev3n1"], ["4.rx", "dev3n2"]]));
        expect(shown).toHaveLength(2);
    });

    test("no stop nor start for a user who is not root", async () => {
        const calls = mockApi({admin: ["ns1"]});
        mockHeartbeatStore(TWO_NODES());
        renderWithRouter(<Heartbeats/>);
        await waitFor(() => expect(calls.some((c) => c.url === "/api/auth/whoami")).toBe(true));
        await act(async () => {});
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Actions"})).not.toBeInTheDocument();
        expect(screen.queryByText("Select streams to start, stop or restart them")).not.toBeInTheDocument();
        // The routine as a word only.
        expect(screen.getAllByText("started").length).toBeGreaterThan(0);
    });

    // ==================== FOLDED STREAMS ====================
    test("the streams table is folded by default under the mesh, its count beside its title", () => {
        mockHeartbeatStore(buildStatus([{node: "node1", streams: [
            {id: "hb#1.rx", state: "running", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}},
            {id: "hb#1.tx", state: "running", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}},
        ]}]));
        renderWithRouter(<Heartbeats/>, {folded: true});
        const toggle = screen.getByRole("button", {name: /^Streams/});
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(toggle).toHaveTextContent("Streams2");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Per page")).not.toBeInTheDocument();
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("table")).toBeInTheDocument();
        fireEvent.click(toggle);
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    test("a link filtering the streams opens them", () => {
        mockHeartbeatStore(buildStatus([{node: "node1", streams: [
            {id: "hb#1.rx", state: "running", type: "unicast", peers: {p: {is_beating: true, desc: "d"}}},
        ]}]));
        renderWithRouter(<Heartbeats/>, {route: "/heartbeats?node=node1", folded: true});
        expect(screen.getByRole("button", {name: /^Streams/})).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("table")).toBeInTheDocument();
    });

    // ==================== PAGES ====================
    const makeManyStreams = (n = 50) => {
        const many = {};
        for (let i = 1; i <= n; i++) {
            many[`node${i}`] = {
                streams: [{
                    id: `hb#${i}.rx`, state: "running", type: "unicast",
                    peers: {
                        peer1: {
                            is_beating: true, desc: `desc${i}`,
                            changed_at: "2025-06-03T04:25:31+00:00",
                            last_beating_at: "2025-06-03T04:25:31+00:00"
                        }
                    },
                }],
            };
        }
        return many;
    };

    test("pages the rows, 50 a page, as oc3 does: the next page, another size", () => {
        mockHeartbeatStore(makeManyStreams(60));
        renderWithRouter(<Heartbeats/>);
        expect(getDataRows()).toHaveLength(50);
        expect(screen.getByText("1–50 of 60")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Next"}));
        expect(getDataRows()).toHaveLength(10);
        expect(screen.getByText("51–60 of 60")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Per page"), {target: {value: "25"}});
        expect(getDataRows()).toHaveLength(25);
        expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    test("a filter changed starts the list over from its first page, the page size kept", async () => {
        mockHeartbeatStore(makeManyStreams(60));
        renderWithRouter(<Heartbeats/>, {route: "/heartbeats?limit=25&offset=50"});
        expect(screen.getByText("51–60 of 60")).toBeInTheDocument();
        fireEvent.change(getFilter("running"), {target: {value: "running"}});
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/heartbeats?limit=25&state=running", {replace: true}));
    });

    // ==================== RESPONSIVE FILTERS ====================
    test.each([
        ["mobile", true, false, true, false],
        ["wide screen", false, true, false, true],
        ["desktop", false, false, false, true],
    ])("filter visibility on %s", async (_, isMobile, isWide, buttonExists, initiallyVisible) => {
        setMedia({mobile: isMobile, wide: isWide});
        mockHeartbeatStore({node1: {streams: []}});
        renderWithRouter(<Heartbeats/>);

        const filterButton = screen.queryByRole("button", {name: /filters/i});
        expect(!!filterButton).toBe(buttonExists);

        const nodeFilter = getFilter("node", {hidden: true});
        if (initiallyVisible) {
            expect(nodeFilter).toBeVisible();
        } else {
            expect(nodeFilter).not.toBeVisible();
            expect(filterButton).toHaveAttribute("aria-expanded", "false");
        }
    });

    test("mobile filter button toggles visibility", async () => {
        setMedia({mobile: true});
        mockHeartbeatStore({node1: {streams: []}});
        renderWithRouter(<Heartbeats/>);

        const filterButton = screen.getByRole("button", {name: "Show filters"});
        expect(filterButton).toHaveAttribute("aria-controls", "heartbeats-filters");
        expect(getFilter("node", {hidden: true})).not.toBeVisible();

        await userEvent.click(filterButton);
        expect(filterButton).toHaveAccessibleName("Hide filters");
        expect(filterButton).toHaveAttribute("aria-expanded", "true");
        expect(getFilter("node")).toBeVisible();

        await userEvent.click(filterButton);
        expect(filterButton).toHaveAccessibleName("Show filters");
        expect(getFilter("node", {hidden: true})).not.toBeVisible();
    });
});
