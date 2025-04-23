export const fetchDaemonStatus = async (token) => {
    const url = '/cluster/status';

    const response = await fetch(url, {
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