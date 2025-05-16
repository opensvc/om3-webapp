import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import {ThemeProvider, createTheme} from "@mui/material/styles";
import Heartbeats, {getStreamStatus} from "../Heartbeats";
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
const renderWithTheme = (ui) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

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
        expect(screen.getByText("Node")).toBeInTheDocument();
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
                                peers: { peer1: { is_beating: true } },
                            },
                            {
                                id: "hb#1.tx",
                                state: "running",
                                peers: { peer1: { is_beating: false } },
                            },
                        ],
                    },
                },
            })
        );

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            const rxChip = screen.getByText("rx").closest(".MuiChip-root");
            const txChip = screen.getByText("tx").closest(".MuiChip-root");

            const rxColor = window.getComputedStyle(rxChip).backgroundColor;
            const txColor = window.getComputedStyle(txChip).backgroundColor;

            expect(rxColor).toBe("rgb(46, 125, 50)"); // green (success.main)
            expect(txColor).toBe("rgb(211, 47, 47)"); // red (error.main)
        });
    });


    test("handles unknown status", async () => {
        useEventStore.mockImplementation((selector) =>
            selector({
                heartbeatStatus: {
                    node1: {
                        streams: [
                            { id: "hb#1.rx", state: "unknown" },
                            { id: "hb#1.tx", state: "unknown" },
                        ],
                    },
                },
            })
        );

        renderWithTheme(<Heartbeats />);

        await waitFor(() => {
            const rxChip = screen.getByText("rx").closest(".MuiChip-root");
            const txChip = screen.getByText("tx").closest(".MuiChip-root");

            const rxColor = window.getComputedStyle(rxChip).backgroundColor;
            const txColor = window.getComputedStyle(txChip).backgroundColor;

            expect(rxColor).toBe("rgb(211, 47, 47)"); // red
            expect(txColor).toBe("rgb(211, 47, 47)"); // red
        });
    });


    test("getStreamStatus returns correct states", () => {
        expect(
            getStreamStatus({
                state: "running",
                peers: {peer1: {is_beating: true}},
            })
        ).toEqual({state: "Beating"});

        expect(
            getStreamStatus({
                state: "running",
                peers: {peer1: {is_beating: false}},
            })
        ).toEqual({state: "Idle"});

        expect(getStreamStatus({state: "stopped"})).toEqual({state: "Stopped"});

        expect(getStreamStatus(null)).toEqual({state: "Unknown"});
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

    test("cleans up on unmount", () => {
        useEventStore.mockReturnValue({heartbeatStatus: {}});
        const {unmount} = renderWithTheme(<Heartbeats/>);
        unmount();
        expect(mockCloseEventSource).toHaveBeenCalled();
    });
});
