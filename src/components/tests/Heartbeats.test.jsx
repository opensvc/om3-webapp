import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import Heartbeats from "../Heartbeats";
import useEventStore from "../../hooks/useEventStore.js";
import {
    closeEventSource,
    startEventReception,
    startLoggerReception,
    closeLoggerEventSource,
} from "../../eventSourceManager.jsx";

// Mock useNavigate to test URL updates
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
}));

jest.mock("../../hooks/useEventStore.js", () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock("../../eventSourceManager.jsx", () => ({
    startEventReception: jest.fn(),
    closeEventSource: jest.fn(),
    startLoggerReception: jest.fn(),
    closeLoggerEventSource: jest.fn(),
}));

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: mockLocalStorage });

const theme = createTheme();

// Updated renderWithRouter using the wrapper option to preserve context during rerender
const renderWithRouter = (ui, { route = "/" } = {}) => {
    const wrapper = ({ children }) => (
        <MemoryRouter initialEntries={[route]}>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </MemoryRouter>
    );
    return render(ui, { wrapper });
};

describe("Heartbeats Component", () => {
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();
    const mockStartLoggerReception = jest.fn();
    const mockCloseLoggerEventSource = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue("valid-token");
        startEventReception.mockImplementation(mockStartEventReception);
        closeEventSource.mockImplementation(mockCloseEventSource);
        startLoggerReception.mockImplementation(mockStartLoggerReception);
        closeLoggerEventSource.mockImplementation(mockCloseLoggerEventSource);
        mockNavigate.mockClear();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("renders basic structure", () => {
        useEventStore.mockReturnValue({ heartbeatStatus: {} });
        renderWithRouter(<Heartbeats />);

        expect(screen.getByRole("table")).toBeInTheDocument();

        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const headerRow = within(table).getByRole("row", {
            name: /RUNNING BEATING ID NODE PEER TYPE DESC CHANGED_AT LAST_BEATING_AT/i,
        });
        expect(within(headerRow).getByText("RUNNING")).toBeInTheDocument();
        expect(within(headerRow).getByText("BEATING")).toBeInTheDocument();
        expect(within(headerRow).getByText("NODE")).toBeInTheDocument();
    });

    test("renders node with heartbeat statuses for all state types", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#2.rx",
                        state: "stopped",
                        peers: {
                            peer2: {
                                is_beating: false,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#3.rx",
                        state: "failed",
                        peers: {
                            peer3: {
                                is_beating: false,
                                desc: ":10013 ← peer3",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#4.rx",
                        state: "warning",
                        peers: {
                            peer4: {
                                is_beating: false,
                                desc: ":10014 ← peer4",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#5.rx",
                        state: "unknown",
                        peers: {
                            peer5: {
                                is_beating: false,
                                desc: ":10015 ← peer5",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(5);

        dataRows.forEach((row, index) => {
            const cells = within(row).getAllByRole("cell");
            expect(cells[2]).toHaveTextContent(`${index + 1}.rx`);
            expect(cells[3]).toHaveTextContent("node1");
            expect(cells[4]).toHaveTextContent(`peer${index + 1}`);
            expect(cells[5]).toHaveTextContent("unicast");
            expect(cells[6]).toHaveTextContent(`:1001${index + 1} ← peer${index + 1}`);
        });
    });

    test("handles default state icon in getStateIcon", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "invalid-state", // Triggers default case
                        peers: { peer1: { is_beating: true, desc: ":10011 ← peer1" } },
                        type: "unicast",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        const dataRow = rows[1]; // Skip header row
        const stateCell = within(dataRow).getAllByRole("cell")[0];
        expect(within(stateCell).getByTestId("HelpIcon")).toBeInTheDocument();
    });

    test("filters by stale status", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { peer1: { is_beating: false, desc: ":10011 ← peer1" } },
                        type: "unicast",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?status=stale" });

        const rows = await screen.findAllByRole("row");
        expect(rows.slice(1)).toHaveLength(1);
        expect(within(rows[1]).getByText("1.rx")).toBeInTheDocument();
    });

    test("handles single node scenario", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);

        const firstRowCells = within(dataRows[0]).getAllByRole("cell");
        expect(firstRowCells[2]).toHaveTextContent("1.rx");
        expect(firstRowCells[3]).toHaveTextContent("node1");
        expect(firstRowCells[4]).toHaveTextContent("peer1");
    });

    test("handles stopped stream with no peers using cached data", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "stopped",
                        peers: {},
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);

        const firstRowCells = within(dataRows[0]).getAllByRole("cell");
        expect(firstRowCells[2]).toHaveTextContent("1.rx");
        expect(firstRowCells[3]).toHaveTextContent("node1");
        expect(firstRowCells[4]).toHaveTextContent("N/A");
        expect(firstRowCells[5]).toHaveTextContent("unicast");
        expect(firstRowCells[6]).toHaveTextContent("N/A");
    });

    // NEW TEST: covers the branch where a stopped stream uses cached peer data
    test("uses cached data when stream becomes stopped with no peers", async () => {
        const initialStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        const stoppedStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "stopped",
                        peers: {},
                        type: "unicast",
                    },
                ],
            },
        };

        // First render with running stream
        useEventStore.mockImplementation((selector) => selector({ heartbeatStatus: initialStatus }));
        const { rerender } = renderWithRouter(<Heartbeats />);

        // Wait for initial rows to render
        let rows = await screen.findAllByRole("row");
        expect(rows.slice(1)).toHaveLength(1);
        let cells = within(rows[1]).getAllByRole("cell");
        expect(cells[4]).toHaveTextContent("peer1");

        // Update to stopped stream with empty peers
        useEventStore.mockImplementation((selector) => selector({ heartbeatStatus: stoppedStatus }));
        rerender(<Heartbeats />);

        // Wait for the cache effect to run and the rows to update with cached data
        await waitFor(() => {
            const updatedRows = screen.getAllByRole("row");
            const updatedCells = within(updatedRows[1]).getAllByRole("cell");
            expect(updatedCells[4]).toHaveTextContent("peer1");
            expect(updatedCells[6]).toHaveTextContent(":10011 ← peer1");
        }, { timeout: 2000 });
    });

    test("applies filter by beating status from URL", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: false,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?status=beating" });

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);
        expect(within(dataRows[0]).getByText("1.rx")).toBeInTheDocument();
    });

    test("initializes with auth token", () => {
        useEventStore.mockReturnValue({ heartbeatStatus: {} });
        renderWithRouter(<Heartbeats />);

        expect(mockLocalStorage.getItem).toHaveBeenCalledWith("authToken");
        expect(startEventReception).toHaveBeenCalledWith("valid-token", [
            "DaemonHeartbeatUpdated",
            "CONNECTION_OPENED",
            "CONNECTION_ERROR",
            "RECONNECTION_ATTEMPT",
            "MAX_RECONNECTIONS_REACHED",
            "CONNECTION_CLOSED",
        ]);
    });

    test("cleans up on unmount", async () => {
        useEventStore.mockReturnValue({ heartbeatStatus: {} });
        const { unmount } = renderWithRouter(<Heartbeats />);
        unmount();
        await waitFor(() => {
            expect(mockCloseEventSource).toHaveBeenCalled();
        });
    });

    test("handles missing auth token", () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        useEventStore.mockReturnValue({ heartbeatStatus: {} });
        renderWithRouter(<Heartbeats />);
        expect(startEventReception).not.toHaveBeenCalled();
    });

    test("handles multiple nodes and complex sorting", async () => {
        const mockHeartbeatStatus = {
            nodeB: {
                streams: [
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: true,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
            nodeA: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(2);

        // Verify that nodes are sorted alphabetically
        const firstRowCells = within(dataRows[0]).getAllByRole("cell");
        const secondRowCells = within(dataRows[1]).getAllByRole("cell");

        expect(firstRowCells[3]).toHaveTextContent("nodeA");
        expect(secondRowCells[3]).toHaveTextContent("nodeB");
    });

    test("handles filter by node", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
            node2: {
                streams: [
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: true,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?node=node1" });

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);
        expect(within(dataRows[0]).getByText("1.rx")).toBeInTheDocument();
        expect(within(dataRows[0]).getByText("node1")).toBeInTheDocument();
    });

    test("handles filter by state", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#2.rx",
                        state: "stopped",
                        peers: {
                            peer2: {
                                is_beating: false,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?state=stopped" });

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);
        expect(within(dataRows[0]).getByText("2.rx")).toBeInTheDocument();
    });

    test("handles filter by id", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: true,
                                desc: ":10012 ← peer2",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?id=1.rx" });

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);
        expect(within(dataRows[0]).getByText("1.rx")).toBeInTheDocument();
    });

    test("handles id with hb# prefix in URL", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?id=hb%231.rx" });

        const rows = await screen.findAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(1);
        expect(within(dataRows[0]).getByText("1.rx")).toBeInTheDocument();
    });

    test("handles edge case with empty streams array", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [],
            },
            node2: {
                streams: null,
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);
        expect(screen.getByRole("table")).toBeInTheDocument();
        const rows = screen.getAllByRole("row");
        expect(rows).toHaveLength(1); // Only header row
    });

    test("handles URL parameter initialization with invalid status", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?status=invalid" });

        await waitFor(() => {
            expect(screen.getByText("1.rx")).toBeInTheDocument();
        });
    });

    test("shows healthy for single node even if not beating", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: false,
                                desc: ":10011 ← peer1",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const rows = await screen.findAllByRole("row");
        expect(rows.slice(1)).toHaveLength(1);
    });

    test("sorts rows by beating", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { peer1: { is_beating: true, desc: "desc1" } },
                        type: "type1",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: { peer2: { is_beating: false, desc: "desc2" } },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const beatingHeader = screen.getByText("BEATING");
        await userEvent.click(beatingHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("2.rx")).toBeInTheDocument(); // false first in asc
        expect(within(rows[1]).getByText("1.rx")).toBeInTheDocument();

        await userEvent.click(beatingHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("1.rx")).toBeInTheDocument(); // true first
        expect(within(rows[1]).getByText("2.rx")).toBeInTheDocument();
    });

    test("sorts rows by id", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#b.rx",
                        state: "running",
                        peers: { peer1: { is_beating: true, desc: "desc1" } },
                        type: "type1",
                    },
                    {
                        id: "hb#a.rx",
                        state: "running",
                        peers: { peer2: { is_beating: true, desc: "desc2" } },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const idHeader = screen.getByText("ID");
        await userEvent.click(idHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("a.rx")).toBeInTheDocument();
        expect(within(rows[1]).getByText("b.rx")).toBeInTheDocument();

        await userEvent.click(idHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("b.rx")).toBeInTheDocument();
        expect(within(rows[1]).getByText("a.rx")).toBeInTheDocument();
    });

    test("sorts rows by peer", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { b_peer: { is_beating: true, desc: "desc1" } },
                        type: "type1",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: { a_peer: { is_beating: true, desc: "desc2" } },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const peerHeader = screen.getByText("PEER");
        await userEvent.click(peerHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("a_peer")).toBeInTheDocument();
        expect(within(rows[1]).getByText("b_peer")).toBeInTheDocument();

        await userEvent.click(peerHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("b_peer")).toBeInTheDocument();
        expect(within(rows[1]).getByText("a_peer")).toBeInTheDocument();
    });

    test("sorts rows by type", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { peer1: { is_beating: true, desc: "desc1" } },
                        type: "b_type",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: { peer2: { is_beating: true, desc: "desc2" } },
                        type: "a_type",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const typeHeader = screen.getByText("TYPE");
        await userEvent.click(typeHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("a_type")).toBeInTheDocument();
        expect(within(rows[1]).getByText("b_type")).toBeInTheDocument();

        await userEvent.click(typeHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("b_type")).toBeInTheDocument();
        expect(within(rows[1]).getByText("a_type")).toBeInTheDocument();
    });

    test("sorts rows by desc", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { peer1: { is_beating: true, desc: "b_desc" } },
                        type: "type1",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: { peer2: { is_beating: true, desc: "a_desc" } },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const descHeader = screen.getByText("DESC");
        await userEvent.click(descHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("a_desc")).toBeInTheDocument();
        expect(within(rows[1]).getByText("b_desc")).toBeInTheDocument();

        await userEvent.click(descHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("b_desc")).toBeInTheDocument();
        expect(within(rows[1]).getByText("a_desc")).toBeInTheDocument();
    });

    test("sorts rows by changed_at", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: "desc1",
                                changed_at: "2024-02-01",
                                last_beating_at: "2024-01-01",
                            },
                        },
                        type: "type1",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: true,
                                desc: "desc2",
                                changed_at: "2024-01-01",
                                last_beating_at: "2024-01-02",
                            },
                        },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const changedHeader = screen.getByText("CHANGED_AT");
        await userEvent.click(changedHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("2024-01-01")).toBeInTheDocument(); // earlier first
        expect(within(rows[1]).getByText("2024-02-01")).toBeInTheDocument();

        await userEvent.click(changedHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("2024-02-01")).toBeInTheDocument();
        expect(within(rows[1]).getByText("2024-01-01")).toBeInTheDocument();
    });

    test("sorts rows by last_beating_at", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: "desc1",
                                changed_at: "2024-01-01",
                                last_beating_at: "2024-02-01",
                            },
                        },
                        type: "type1",
                    },
                    {
                        id: "hb#2.rx",
                        state: "running",
                        peers: {
                            peer2: {
                                is_beating: true,
                                desc: "desc2",
                                changed_at: "2024-01-02",
                                last_beating_at: "2024-01-01",
                            },
                        },
                        type: "type2",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        const lastBeatingHeader = screen.getByText("LAST_BEATING_AT");
        await userEvent.click(lastBeatingHeader);

        let rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("2024-01-01")).toBeInTheDocument(); // earlier first
        expect(within(rows[1]).getByText("2024-02-01")).toBeInTheDocument();

        await userEvent.click(lastBeatingHeader); // desc

        rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("2024-02-01")).toBeInTheDocument();
        expect(within(rows[1]).getByText("2024-01-01")).toBeInTheDocument();
    });

    test("sorting by different column resets direction to asc", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#b.rx",
                        state: "running",
                        peers: { p: { is_beating: true } },
                        type: "t",
                    },
                    {
                        id: "hb#a.rx",
                        state: "running",
                        peers: { p: { is_beating: true } },
                        type: "t",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />);

        // Sort by BEATING twice to get descending
        const beatingHeader = screen.getByText("BEATING");
        await userEvent.click(beatingHeader); // asc
        await userEvent.click(beatingHeader); // desc

        // Now click ID column
        const idHeader = screen.getByText("ID");
        await userEvent.click(idHeader);

        // Should be sorted by ID ascending
        const rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("a.rx")).toBeInTheDocument();
        expect(within(rows[1]).getByText("b.rx")).toBeInTheDocument();
    });

    test("does not update URL if filter value unchanged", async () => {
        const mockHeartbeatStatus = {
            node1: { streams: [{ id: "hb#1.rx", state: "running", peers: {}, type: "t" }] },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?node=node1" });

        // Wait a bit to ensure no navigation is triggered
        await waitFor(() => {
            expect(mockNavigate).not.toHaveBeenCalled();
        }, { timeout: 500 });
    });

    test("displays message when no heartbeats match filters", async () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: { peer1: { is_beating: true, desc: "desc" } },
                        type: "unicast",
                    },
                ],
            },
        };
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: mockHeartbeatStatus })
        );

        renderWithRouter(<Heartbeats />, { route: "/?node=nonexistent" });

        await waitFor(() => {
            expect(
                screen.getByText("No heartbeats found matching the current filters.")
            ).toBeInTheDocument();
        });
    });

    test("loads more rows when scrolling near bottom", async () => {
        // Generate 50 rows
        const manyStreams = {};
        for (let i = 1; i <= 50; i++) {
            manyStreams[`node${i}`] = {
                streams: [
                    {
                        id: `hb#${i}.rx`,
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: true,
                                desc: `desc${i}`,
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            };
        }
        useEventStore.mockImplementation((selector) =>
            selector({ heartbeatStatus: manyStreams })
        );

        renderWithRouter(<Heartbeats />);

        // Initially shows 30 rows
        let rows = await screen.findAllByRole("row");
        expect(rows.slice(1)).toHaveLength(30);

        // Get table container
        const container = document.querySelector(".MuiTableContainer-root");
        expect(container).toBeInTheDocument();

        // Mock scroll dimensions
        Object.defineProperty(container, "scrollHeight", { value: 1000, configurable: true });
        Object.defineProperty(container, "clientHeight", { value: 200, configurable: true });

        // Scroll to 70% (not enough)
        container.scrollTop = 700;
        fireEvent.scroll(container);

        // Should still have 30 rows
        rows = screen.getAllByRole("row");
        expect(rows.slice(1)).toHaveLength(30);

        // Scroll to 85% (above threshold)
        container.scrollTop = 850;
        fireEvent.scroll(container);

        // Wait for loading and more rows to appear
        await waitFor(
            () => {
                const updatedRows = screen.getAllByRole("row");
                expect(updatedRows.slice(1).length).toBeGreaterThan(30);
            },
            { timeout: 2000 }
        );
    });
});