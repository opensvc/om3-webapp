import {fetchDaemonStatus} from "../api";
import {URL_CLUSTER_STATUS} from "../../config/apiPath";

// Mock global fetch
global.fetch = jest.fn();

describe("fetchDaemonStatus", () => {
    const token = "fake-token";

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("calls fetch with correct URL and headers", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockData,
        });

        const result = await fetchDaemonStatus(token);

        expect(fetch).toHaveBeenCalledWith(URL_CLUSTER_STATUS, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        expect(result).toEqual(mockData);
    });

    test("throws error when response is not ok", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({error: "Server error"}),
        });

        await expect(fetchDaemonStatus(token)).rejects.toThrow("Failed to fetch data");
    });
});
