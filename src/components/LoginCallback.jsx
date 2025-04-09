//import useClusterStatus from '../hooks/ClusterStatus.jsx'
import {useStateValue} from "../state.jsx"

function LoginCallback() {
    //const { close } = useClusterStatus()
    const [{authChoice}, dispatch] = useStateValue()
    console.log("login callback")
    if (authChoice != "openid") {
        dispatch({type: "setAuthChoice", data: "openid"})
    }
    window.close()
    return null
}

export default LoginCallback
