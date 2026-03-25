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
            if (parsedBody.message && typeof parsedBody.message === 'string' && parsedBody.message.trim() !== '') {
                serverMessage = parsedBody.message;
            } else {
                serverMessage = JSON.stringify(parsedBody);
            }
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

export async function getResponseErrorMessage(response) {
    if (!response) {
        return null;
    }

    try {
        let text = '';
        if (typeof response.text === 'function') {
            text = await response.text();
        }

        if (!text) {
            return null;
        }

        try {
            const json = JSON.parse(text);
            if (json && typeof json === 'object') {
                if (typeof json.message === 'string' && json.message.trim() !== '') {
                    return json.message;
                }
                if (typeof json.error === 'string' && json.error.trim() !== '') {
                    return json.error;
                }
                if (typeof json.detail === 'string' && json.detail.trim() !== '') {
                    return json.detail;
                }
                if (typeof json.title === 'string' && json.title.trim() !== '') {
                    return json.title;
                }
                // Keep plain text for object to avoid raw JSON display
                if (json && Object.keys(json).length === 0) {
                    return null;
                }
                return Object.keys(json).length > 0 ? Object.values(json).join(' | ') : null;
            }
        } catch (e) {
            // not JSON
        }

        return text;
    } catch (e) {
        return null;
    }
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
