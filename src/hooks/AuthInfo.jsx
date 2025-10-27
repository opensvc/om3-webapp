import {useState, useEffect} from "react";
import {URL_AUTH_INFO} from "../config/apiPath.js";
import logger from '../utils/logger.js';

function useAuthInfo() {
    const [authInfo, setAuthInfo] = useState();

    useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            try {
                const res = await fetch(URL_AUTH_INFO);
                const data = await res.json();
                if (isMounted) {
                    setAuthInfo(data);
                }
            } catch (e) {
                if (isMounted) {
                    logger.error(e);
                }
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, []);

    return authInfo;
}

export default useAuthInfo;
