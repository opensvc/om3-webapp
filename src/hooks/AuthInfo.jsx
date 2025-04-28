import {useState, useEffect} from "react";
import {URL_AUTH_INFO} from "../config/apiPath.js";

function useAuthInfo() {
    const [authInfo, setAuthInfo] = useState()
    useEffect(() => {
        async function fetchData() {
            const res = await fetch(URL_AUTH_INFO)
            res
                .json()
                .then((data) => {
                    setAuthInfo(data)
                })
                .catch((e) => {
                    console.log(e)
                })
        }

        fetchData()
    }, [])
    return authInfo
}

export default useAuthInfo
