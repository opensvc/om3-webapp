import {useState, useEffect} from 'react';

export default function useOnlineStatus() {
    const getOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [online, setOnline] = useState(getOnline());

    useEffect(() => {
        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // In case the browser doesn't emit events reliably, check periodically briefly
        const checkInterval = setInterval(() => {
            const current = getOnline();
            setOnline(current);
        }, 15000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(checkInterval);
        };
    }, []);

    return online;
}
