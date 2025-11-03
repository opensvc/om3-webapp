import {URL_CLUSTER_STATUS} from "../config/apiPath.js";

// ApiError encapsulates HTTP errors with status and optional server body
export class ApiError extends Error {
    constructor(message, {status = null, statusText = null, body = null} = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.statusText = statusText;
        this.body = body; // parsed JSON or text from server when available
    }
}

// Centralized fetch wrapper that returns parsed JSON on success and throws ApiError on failure
export async function apiFetch(url, options = {}) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (networkErr) {
        // Network-level error (DNS, CORS, connection, aborted, etc.)
        throw new ApiError(networkErr.message || 'Network error', { body: null });
    }

        const headers = response.headers || {};
        const contentType = (headers.get && headers.get('content-type')) || '';
        let parsedBody = null;

        // Try to parse JSON when content-type indicates JSON
        if (contentType.includes('application/json')) {
            try {
                parsedBody = await response.json();
            } catch (e) {
                parsedBody = null;
            }
        }

        // Fallbacks: if no parsedBody yet, try response.json() if available, then response.text()
        if (parsedBody === null) {
            if (typeof response.json === 'function') {
                try {
                    parsedBody = await response.json();
                } catch (e) {
                    parsedBody = null;
                }
            }
        }

        if (parsedBody === null) {
            if (typeof response.text === 'function') {
                try {
                    parsedBody = await response.text();
                } catch (e) {
                    parsedBody = null;
                }
            }
        }

    if (!response.ok) {
        const serverMessage = parsedBody && typeof parsedBody === 'object' ? parsedBody.message || JSON.stringify(parsedBody) : parsedBody;
        const message = serverMessage || response.statusText || `Request failed with status ${response.status}`;
        throw new ApiError(message, { status: response.status, statusText: response.statusText, body: parsedBody });
    }

    return parsedBody;
}

export const fetchDaemonStatus = async (token) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return await apiFetch(URL_CLUSTER_STATUS, {method: 'GET', headers});
};