import { useState, useEffect } from "react";
import { URL_AUTH_INFO } from "../config/apiPath.js";

// Définir une interface pour authInfo
interface AuthInfo {
    openid?: {
        authority: string;
        client_id: string;
    };
    methods?: string[];
}

function useAuthInfo(): AuthInfo | undefined {
    const [authInfo, setAuthInfo] = useState<AuthInfo | undefined>();

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
                    console.log(e);
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
