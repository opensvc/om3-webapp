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
const renderWithTheme = (ui, {initialPath = "/"} = {}) => {
    return render(
        <BrowserRouter initialEntries={[initialPath]}>
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
        startEventReception.mockClear();
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
        expect(screen.getByText("RUNNING")).toBeInTheDocument();
        expect(screen.getByText("BEATING")).toBeInTheDocument();
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
            expect(within(firstRowCells[0]).getByTestId("CheckCircleIcon")).toBeInTheDocument(); // RUNNING
            expect(within(firstRowCells[1]).getByTestId("CheckCircleIcon")).toBeInTheDocument(); // BEATING
            expect(firstRowCells[2]).toHaveTextContent("hb#1.rx");
            expect(firstRowCells[3]).toHaveTextContent("node1");
            expect(firstRowCells[4]).toHaveTextContent("peer1");

            const secondRowCells = within(dataRows[1]).getAllByRole("cell");
            expect(within(secondRowCells[0]).getByTestId("CheckCircleIcon")).toBeInTheDocument(); // RUNNING
            expect(within(secondRowCells[1]).getByTestId("CancelIcon")).toBeInTheDocument(); // BEATING
            expect(secondRowCells[2]).toHaveTextContent("hb#1.tx");
            expect(secondRowCells[3]).toHaveTextContent("node1");
            expect(secondRowCells[4]).toHaveTextContent("peer1");
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
            expect(within(firstRowCells[0]).getByTestId("CheckCircleIcon")).toBeInTheDocument(); // RUNNING
            expect(within(firstRowCells[1]).getByTestId("CancelIcon")).toBeInTheDocument(); // BEATING fallback
            expect(firstRowCells[2]).toHaveTextContent("hb#1.rx");
            expect(firstRowCells[3]).toHaveTextContent("node1");
            expect(firstRowCells[4]).toHaveTextContent("N/A");
            expect(firstRowCells[5]).toHaveTextContent("unicast");
            expect(firstRowCells[6]).toHaveTextContent("N/A");
            expect(firstRowCells[7]).toHaveTextContent("N/A");

            const secondRowCells = within(dataRows[1]).getAllByRole("cell");
            expect(within(secondRowCells[0]).getByTestId("CheckCircleIcon")).toBeInTheDocument(); // RUNNING
            expect(within(secondRowCells[1]).getByTestId("CancelIcon")).toBeInTheDocument(); // BEATING fallback
            expect(secondRowCells[4]).toHaveTextContent("N/A");
        });
    });

    test("initializes with auth token", async () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        renderWithTheme(<Heartbeats/>);

        await waitFor(() => {
            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("authToken");
            expect(startEventReception).toHaveBeenCalledWith("valid-token");
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
