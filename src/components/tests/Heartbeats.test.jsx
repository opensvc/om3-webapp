import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import {ThemeProvider, createTheme} from "@mui/material/styles";
import {BrowserRouter} from "react-router-dom";
import Heartbeats from "../Heartbeats";
import useEventStore from "../../hooks/useEventStore.js";
import useFetchDaemonStatus from "../../hooks/useFetchDaemonStatus.jsx";
import {closeEventSource} from "../../eventSourceManager.jsx";

// Mock hooks
jest.mock("../../hooks/useEventStore.js");
jest.mock("../../hooks/useFetchDaemonStatus.jsx");
jest.mock("../../eventSourceManager.jsx");

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(window, "localStorage", {value: mockLocalStorage});

const theme = createTheme();
const renderWithTheme = (ui, {initialPath = "/"} = {}) => {
    return render(
        <BrowserRouter initialEntries={[initialPath]}>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </BrowserRouter>
    );
};

describe("Heartbeats Component", () => {
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();
    const mockCloseEventSource = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue("valid-token");
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });
        closeEventSource.mockImplementation(mockCloseEventSource);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("renders basic structure", () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        renderWithTheme(<Heartbeats/>);

        expect(screen.getByRole("heading", {name: /Heartbeats/i})).toBeInTheDocument();
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("NODE")).toBeInTheDocument();
    });

    test("renders node with heartbeat statuses", async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                heartbeatStatus: {
                    node1: {
                        streams: [
                            {
                                id: "hb#1.rx",
                                state: "running",
                                peers: {
                                    peer1: {
                                        is_beating: true,
                                        desc: ":10011 ← peer1",
                                        last_at: "2025-06-03T04:25:31+00:00",
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
                                        last_at: "2025-06-03T04:25:31+00:00",
                                    },
                                },
                                type: "unicast",
                            },
                        ],
                    },
                },
            })
        );

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            expect(dataRows).toHaveLength(2);

            const firstRowCells = within(dataRows[0]).getAllByRole("cell");
            expect(firstRowCells[0]).toHaveTextContent("✅");
            expect(firstRowCells[1]).toHaveTextContent("hb#1.rx");
            expect(firstRowCells[2]).toHaveTextContent("node1");
            expect(firstRowCells[3]).toHaveTextContent("peer1");

            const secondRowCells = within(dataRows[1]).getAllByRole("cell");
            expect(secondRowCells[0]).toHaveTextContent("❌");
            expect(secondRowCells[1]).toHaveTextContent("hb#1.tx");
            expect(secondRowCells[2]).toHaveTextContent("node1");
            expect(firstRowCells[3]).toHaveTextContent("peer1");
        });
    });

    test("handles missing peer data", async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                heartbeatStatus: {
                    node1: {
                        streams: [
                            {
                                id: "hb#1.rx",
                                state: "running",
                                peers: {},
                                type: "unicast",
                            },
                            {
                                id: "hb#1.tx",
                                state: "running",
                                peers: {},
                                type: "unicast",
                            },
                        ],
                    },
                },
            })
        );

        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            const rows = screen.getAllByRole("row");
            const dataRows = rows.slice(1);
            expect(dataRows).toHaveLength(2);

            const firstRowCells = within(dataRows[0]).getAllByRole("cell");
            expect(firstRowCells[0]).toHaveTextContent("❌");
            expect(firstRowCells[1]).toHaveTextContent("hb#1.rx");
            expect(firstRowCells[2]).toHaveTextContent("node1");
            expect(firstRowCells[3]).toHaveTextContent("N/A");
            expect(firstRowCells[5]).toHaveTextContent("N/A");
            expect(firstRowCells[6]).toHaveTextContent("N/A");

            const secondRowCells = within(dataRows[1]).getAllByRole("cell");
            expect(secondRowCells[0]).toHaveTextContent("❌");
            expect(secondRowCells[1]).toHaveTextContent("hb#1.tx");
            expect(secondRowCells[2]).toHaveTextContent("node1");
            expect(secondRowCells[3]).toHaveTextContent("N/A");
        });
    });

    test("initializes with auth token", async () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("authToken");
            expect(mockFetchNodes).toHaveBeenCalledWith("valid-token");
            expect(mockStartEventReception).toHaveBeenCalledWith("valid-token");
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