import React from "react";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import ClusterOverview from "./Cluster.jsx";
import {MemoryRouter} from "react-router-dom";
import axios from "axios";

jest.mock("axios");
jest.mock("../hooks/useEventStore.js", () => () => ({
    nodeStatus: {
        node1: {frozen_at: null},
        node2: {frozen_at: "2023-01-01T00:00:00Z"},
    },
    objectStatus: {
        "ns1/obj1/inst1": {avail: "UP"},
        "ns1/obj2/inst1": {avail: "DOWN"},
        "ns2/obj3/inst1": {avail: "warn"},
        "ns2/obj4/inst1": {},
    },
    heartbeatStatus: {
        hb1: {},
        hb2: {},
    },
}));

jest.mock("../hooks/useFetchDaemonStatus", () => () => ({
    fetchNodes: jest.fn(),
    startEventReception: jest.fn(),
}));

describe("ClusterOverview", () => {
    beforeEach(() => {
        localStorage.setItem("authToken", "fake-token");

        axios.get.mockResolvedValue({
            data: {items: [{}, {}, {}]}  // simulate 3 pools
        });
    });

    it("renders titles and counts correctly", async () => {
        render(<ClusterOverview />, {wrapper: MemoryRouter});

        // Attend que le poolCount soit mis à jour via useEffect
        await waitFor(() => {
            expect(screen.getByText("Cluster Overview")).toBeInTheDocument();
            expect(screen.getByText(/Storage Pools/i)).toBeInTheDocument();
        });

        expect(screen.getByText("2")).toBeInTheDocument(); // 2 nodes
        expect(screen.getByText("1 Frozen")).toBeInTheDocument();
        expect(screen.getByText("1 Unfrozen")).toBeInTheDocument();

        expect(screen.getByText("4")).toBeInTheDocument(); // 4 objects
        expect(screen.getByText(/ns1: 2/)).toBeInTheDocument();
        expect(screen.getByText(/ns2: 2/)).toBeInTheDocument();

        expect(screen.getByText("2")).toBeInTheDocument(); // 2 heartbeats
        expect(screen.getByText("3")).toBeInTheDocument(); // 3 pools
    });

    it("navigates when tiles are clicked", async () => {
        const mockNavigate = jest.fn();
        jest.mock("react-router-dom", () => ({
            ...jest.requireActual("react-router-dom"),
            useNavigate: () => mockNavigate,
        }));

        render(<ClusterOverview />, {wrapper: MemoryRouter});

        // simulate click on Nodes tile
        const nodeTile = screen.getByRole("button", {name: /nodes/i});
        fireEvent.click(nodeTile);
        expect(mockNavigate).toHaveBeenCalledWith("/nodes");
    });

    it("does nothing if no auth token", async () => {
        localStorage.removeItem("authToken");

        render(<ClusterOverview />, {wrapper: MemoryRouter});
        await waitFor(() => {
            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    it("displays unknown count when object availability is missing", async () => {
        render(<ClusterOverview />, {wrapper: MemoryRouter});

        await waitFor(() => {
            const unknownStatus = screen.getByText(/Unknown/i);
            expect(unknownStatus).toBeInTheDocument();
        });
    });
});
