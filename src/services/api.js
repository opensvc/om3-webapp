export const fetchData = async (token) => {
    const url = '/daemon/status';

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    console.log("Réponse brute :", response);

    if (!response.ok) {
        throw new Error('Failed to fetch data');
    }

    const data = await response.json();

    console.log("Données reçues :", data);

    return data;
};