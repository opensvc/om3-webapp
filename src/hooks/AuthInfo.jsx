import {useState, useEffect} from "react";

function useAuthInfo() {
    const [authInfo, setAuthInfo] = useState()
    useEffect(() => {
        async function fetchData() {
            const res = await fetch('/auth/info')
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
