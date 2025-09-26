import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import {ThemeProvider, createTheme} from "@mui/material/styles";
import {BrowserRouter} from "react-router-dom";
import Heartbeats from "../Heartbeats";
import useEventStore from "../../hooks/useEventStore.js";
import {closeEventSource, startEventReception} from "../../eventSourceManager.jsx";

jest.mock("../../hooks/useEventStore.js");
jest.mock("../../eventSourceManager.jsx");

const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", {value: mockLocalStorage});

const theme = createTheme();
const renderWithTheme = (ui = {}) => {
    return render(
        <BrowserRouter>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </BrowserRouter>
    );
};

describe("Heartbeats Component", () => {
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue("valid-token");
        startEventReception.mockImplementation(mockStartEventReception);
        closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("renders basic structure", () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});

        renderWithTheme(<Heartbeats/>);

        expect(screen.getByRole("heading", {name: /Heartbeats/i})).toBeInTheDocument();

        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const headerRow = within(table).getByRole("row", {name: /RUNNING BEATING ID NODE PEER TYPE DESC CHANGED_AT LAST_BEATING_AT/i});
        expect(within(headerRow).getByText("RUNNING")).toBeInTheDocument();
        expect(within(headerRow).getByText("BEATING")).toBeInTheDocument();
        expect(within(headerRow).getByText("NODE")).toBeInTheDocument();
    });

    test("renders node with heartbeat statuses", async () => {
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
                        id: "hb#1.tx",
                        state: "running",
                        peers: {
                            peer1: {
                                is_beating: false,
                                desc: "→ peer1:10011",
                                changed_at: "2025-06-03T04:25:31+00:00",
                                last_beating_at: "2025-06-03T04:25:31+00:00",
                            },
                        },
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockImplementation((selector) => selector({
            heartbeatStatus: mockHeartbeatStatus
        }));

        renderWithTheme(<Heartbeats/>);

        const rows = screen.getAllByRole("row");
        const dataRows = rows.slice(1);
        expect(dataRows).toHaveLength(2);

        const firstRowCells = within(dataRows[0]).getAllByRole("cell");
        expect(firstRowCells[2]).toHaveTextContent("1.rx");
        expect(firstRowCells[3]).toHaveTextContent("node1");
        expect(firstRowCells[4]).toHaveTextContent("peer1");
        expect(firstRowCells[5]).toHaveTextContent("unicast");
        expect(firstRowCells[6]).toHaveTextContent(":10011 ← peer1");
        expect(firstRowCells[7]).toHaveTextContent("2025-06-03T04:25:31+00:00");
        expect(firstRowCells[8]).toHaveTextContent("2025-06-03T04:25:31+00:00");

        const secondRowCells = within(dataRows[1]).getAllByRole("cell");
        expect(secondRowCells[2]).toHaveTextContent("1.tx");
        expect(secondRowCells[3]).toHaveTextContent("node1");
        expect(secondRowCells[4]).toHaveTextContent("peer1");
        expect(secondRowCells[5]).toHaveTextContent("unicast");
        expect(secondRowCells[6]).toHaveTextContent("→ peer1:10011");
        expect(secondRowCells[7]).toHaveTextContent("2025-06-03T04:25:31+00:00");
        expect(secondRowCells[8]).toHaveTextContent("2025-06-03T04:25:31+00:00");
    });

    test("handles missing peer data for running streams", () => {
        const mockHeartbeatStatus = {
            node1: {
                streams: [
                    {
                        id: "hb#1.rx",
                        state: "running",
                        peers: {},
                        type: "unicast",
                    },
                ],
            },
        };

        useEventStore.mockReturnValue({
            heartbeatStatus: mockHeartbeatStatus
        });

        renderWithTheme(<Heartbeats/>);

        const table = screen.getByRole("table");
        expect(table).toBeInTheDocument();

        const rows = screen.getAllByRole("row");

        expect(rows).toHaveLength(1);

        const headerRow = rows[0];
        expect(within(headerRow).getByText("RUNNING")).toBeInTheDocument();
        expect(within(headerRow).getByText("BEATING")).toBeInTheDocument();
        expect(within(headerRow).getByText("ID")).toBeInTheDocument();
        expect(within(headerRow).getByText("NODE")).toBeInTheDocument();
    });

    test("initializes with auth token", async () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("authToken");
            expect(startEventReception).toHaveBeenCalledWith("valid-token", ["DaemonHeartbeatUpdated"]);
        });
    });

    test("cleans up on unmount", async () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        const {unmount} = renderWithTheme(<Heartbeats/>);
        unmount();
        await waitFor(() => {
            expect(mockCloseEventSource).toHaveBeenCalled();
        });
    });
});
