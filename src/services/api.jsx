import {URL_CLUSTER_STATUS} from "../config/apiPath.js";

export const fetchDaemonStatus = async (token) => {
    const response = await fetch(URL_CLUSTER_STATUS, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });


    if (!response.ok) {
        throw new Error('Failed to fetch data');
    }

    const data = await response.json();

    return data;
};