import {fetchDaemonStatus} from "../api";
import {URL_CLUSTER_STATUS} from "../../config/apiPath";

// Mock global fetch
global.fetch = jest.fn();

// Helper to create a mock Headers object
const createHeaders = (contentType) => ({
    get: (key) => key === 'content-type' ? contentType : null
});

// Helper to create a mock Headers object without get method
const createHeadersWithoutGet = () => ({});

describe("fetchDaemonStatus", () => {
    const token = "fake-token";

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Mock AbortController for consistent testing
        global.AbortController = jest.fn(() => ({
            abort: jest.fn(),
            signal: {
                aborted: false,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            }
        }));

        // Mock clearTimeout to avoid timer issues
        global.clearTimeout = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("calls fetch with correct URL and headers", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("application/json"),
            json: async () => mockData,
            text: async () => JSON.stringify(mockData),
        });

        const result = await fetchDaemonStatus(token);

        expect(fetch).toHaveBeenCalledWith(
            URL_CLUSTER_STATUS,
            expect.objectContaining({
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
        );

        // Verify signal is present
        const fetchCall = fetch.mock.calls[0];
        expect(fetchCall[1]).toHaveProperty('signal');
        expect(fetchCall[1].signal).toBeDefined();

        expect(result).toEqual(mockData);
    });

    test("throws ApiError with server message when response is not ok and has JSON body", async () => {
        const mockErrorBody = {error: "Server error", details: "Something went wrong"};

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            headers: createHeaders("application/json"),
            json: async () => mockErrorBody,
            text: async () => JSON.stringify(mockErrorBody),
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: '{"error":"Server error","details":"Something went wrong"}',
            status: 500,
            statusText: "Internal Server Error",
            body: mockErrorBody
        });
    });

    test("throws ApiError with status text when response is not ok and has no body", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            headers: createHeaders("text/plain"),
            json: async () => {
                throw new Error("No JSON");
            },
            text: async () => "",
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: "Not Found",
            status: 404,
            statusText: "Not Found",
        });
    });

    test("throws ApiError with generic message when response is not ok and no status text", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: "",
            headers: createHeaders("text/plain"),
            json: async () => {
                throw new Error("No JSON");
            },
            text: async () => "",
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: "Request failed with status 403",
            status: 403,
            statusText: "",
        });
    });

    test("handles network errors correctly", async () => {
        const networkError = new Error("Network failure");
        fetch.mockRejectedValueOnce(networkError);

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: "Network failure",
            status: null,
            body: null
        });
    });

    test("works without token when token is not provided", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("application/json"),
            json: async () => mockData,
            text: async () => JSON.stringify(mockData),
        });

        const result = await fetchDaemonStatus(null);

        expect(fetch).toHaveBeenCalledWith(
            URL_CLUSTER_STATUS,
            expect.objectContaining({
                method: "GET",
                headers: {},
            })
        );

        // Verify signal is present
        const fetchCall = fetch.mock.calls[0];
        expect(fetchCall[1]).toHaveProperty('signal');
        expect(fetchCall[1].signal).toBeDefined();

        expect(result).toEqual(mockData);
    });

    test("handles non-JSON error response with text body", async () => {
        const errorText = "Simple error message";

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            headers: createHeaders("text/plain"),
            json: async () => {
                throw new Error("Not JSON");
            },
            text: async () => errorText,
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: errorText,
            status: 400,
            statusText: "Bad Request",
            body: errorText
        });
    });

    test("handles response without headers.get method", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeadersWithoutGet(), // Headers without get method
            json: async () => mockData,
            text: async () => JSON.stringify(mockData),
        });

        const result = await fetchDaemonStatus(token);

        expect(result).toEqual(mockData);
    });

    test("handles JSON content-type with invalid JSON response", async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("application/json"),
            json: async () => {
                throw new Error("Invalid JSON");
            },
            text: async () => "invalid json string",
        });

        // Expect the call to succeed despite JSON parsing error
        await expect(fetchDaemonStatus(token)).resolves.toBeDefined();
    });

    test("handles response without json method", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("text/plain"),
            // No json method
            text: async () => JSON.stringify(mockData),
        });

        const result = await fetchDaemonStatus(token);

        // Should handle the case where response.json is not available
        expect(result).toBeDefined();
    });

    test("handles response without text method", async () => {
        const mockData = {status: "ok"};

        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("text/plain"),
            json: async () => mockData,
            // No text method
        });

        const result = await fetchDaemonStatus(token);

        // Should handle the case where response.text is not available
        expect(result).toEqual(mockData);
    });

    test("handles error response with JSON message in body", async () => {
        const mockErrorBody = {message: "Custom error message"};

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            headers: createHeaders("application/json"),
            json: async () => mockErrorBody,
            text: async () => JSON.stringify(mockErrorBody),
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: "Custom error message",
            status: 400,
            body: mockErrorBody
        });
    });

    test("handles error response with string body that has message property", async () => {
        const errorString = JSON.stringify({message: "String error message"});

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            headers: createHeaders("text/plain"),
            json: async () => {
                throw new Error("Not JSON");
            },
            text: async () => errorString,
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: errorString,
            status: 400,
            body: errorString
        });
    });

    test("handles error with null body after all parsing attempts", async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: "Server Error",
            headers: createHeaders("application/octet-stream"), // Unrecognized type
            json: async () => {
                throw new Error("No JSON");
            },
            text: async () => {
                throw new Error("No text");
            },
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: "Server Error",
            status: 500,
            body: null
        });
    });

    test("handles error with object body without message property", async () => {
        const mockErrorBody = {error: "Error without message field"};

        fetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            headers: createHeaders("application/json"),
            json: async () => mockErrorBody,
            text: async () => JSON.stringify(mockErrorBody),
        });

        await expect(fetchDaemonStatus(token)).rejects.toMatchObject({
            name: 'ApiError',
            message: JSON.stringify(mockErrorBody),
            status: 400,
            body: mockErrorBody
        });
    });
    test("throws ApiError on request timeout", async () => {
        jest.useFakeTimers();
        // Override AbortController mock to handle listeners properly
        const listeners = [];
        global.AbortController = jest.fn(() => ({
            abort: () => {
                listeners.forEach(listener => listener());
            },
            signal: {
                aborted: false,
                addEventListener: (type, listener) => {
                    if (type === 'abort') {
                        listeners.push(listener);
                    }
                },
                removeEventListener: (type, listener) => {
                    if (type === 'abort') {
                        const index = listeners.indexOf(listener);
                        if (index > -1) {
                            listeners.splice(index, 1);
                        }
                    }
                },
                dispatchEvent: jest.fn(),
            }
        }));
        // Mock fetch to reject on abort
        fetch.mockImplementationOnce((url, options) => {
            return new Promise((resolve, reject) => {
                const abortError = new Error('Operation aborted');
                abortError.name = 'AbortError';
                options.signal.addEventListener('abort', () => reject(abortError));
            });
        });
        const timeoutMs = 5000;
        const promise = fetchDaemonStatus(token, { timeout: timeoutMs });
        jest.advanceTimersByTime(timeoutMs);
        await expect(promise).rejects.toMatchObject({
            name: 'ApiError',
            message: `Request timed out after ${timeoutMs}ms`,
            body: null
        });
        jest.useRealTimers();
    });
    test("handles response without json and text methods", async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: createHeaders("application/json"),
            // No json or text methods
        });
        const result = await fetchDaemonStatus(token);
        expect(result).toBeNull();
    });
});
