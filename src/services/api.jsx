import {URL_CLUSTER_STATUS} from "../config/apiPath.js";

export class ApiError extends Error {
    constructor(message, {status = null, statusText = null, body = null} = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.statusText = statusText;
        this.body = body;
    }
}

export async function apiFetch(url, options = {}) {
    const controller = new AbortController();
    const timeoutMs = options.timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (networkErr) {
        clearTimeout(timeoutId);
        if (networkErr.name === 'AbortError') {
            throw new ApiError(`Request timed out after ${timeoutMs}ms`, {body: null});
        }
        throw new ApiError(networkErr.message || 'Network error', {body: null});
    }

    let parsedBody = null;

    // Vérification plus sûre pour headers.get
    let contentType = null;
    if (response.headers && typeof response.headers.get === 'function') {
        contentType = response.headers.get('content-type');
    }

    try {
        if (contentType && contentType.includes('application/json')) {
            if (typeof response.json === 'function') {
                parsedBody = await response.json();
            }
        }

        if (parsedBody === null) {
            if (typeof response.json === 'function') {
                try {
                    parsedBody = await response.json();
                } catch (jsonError) {
                    if (typeof response.text === 'function') {
                        try {
                            parsedBody = await response.text();
                        } catch (textError) {
                            parsedBody = null;
                        }
                    }
                }
            } else if (typeof response.text === 'function') {
                try {
                    parsedBody = await response.text();
                } catch (textError) {
                    parsedBody = null;
                }
            }
        }
    } catch (parseError) {
        parsedBody = null;
    }

    if (!response.ok) {
        let serverMessage = parsedBody;

        if (parsedBody && typeof parsedBody === 'object') {
            serverMessage = parsedBody.message || JSON.stringify(parsedBody);
        }

        const message = serverMessage ||
            response.statusText ||
            `Request failed with status ${response.status}`;

        throw new ApiError(message, {
            status: response.status,
            statusText: response.statusText,
            body: parsedBody
        });
    }

    return parsedBody;
}

export const fetchDaemonStatus = async (token, options = {}) => {
    const headers = {
        ...options.headers,
        ...(token && {Authorization: `Bearer ${token}`})
    };

    return await apiFetch(URL_CLUSTER_STATUS, {
        method: 'GET',
        headers,
        ...options
    });
};
