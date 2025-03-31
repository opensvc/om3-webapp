import React from "react";
import { useStateValue } from "../state";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

function AuthChoice() {
    const [state, dispatch] = useStateValue();
    const { authInfo } = state;

    console.log("authInfo:", authInfo);
    console.log("AuthInfo OpenID well_known_uri:", authInfo?.openid?.well_known_uri);
    console.log("AuthInfo Methods:", authInfo?.methods);
    console.log("Afficher OpenID:", !!(authInfo?.openid?.well_known_uri));
    console.log("Afficher Basic:", authInfo?.methods?.includes("basic"));


    const handleAuthChoice = (choice) => {
        dispatch({ type: "setAuthChoice", data: choice });
    };

    return (
        <Dialog open={true} aria-labelledby="dialog-title">
            <DialogTitle id="dialog-title">
                Authentication Methods
            </DialogTitle>
            <DialogContent>
                Please select one of the following authentication methods the cluster advertizes.
            </DialogContent>
            <DialogActions>
                {authInfo && authInfo.openid && authInfo.openid.well_known_uri && (
                    <Button onClick={() => handleAuthChoice("openid")}>OpenId</Button>
                )}
                <Button onClick={() => handleAuthChoice("x509")}>x509</Button>
                {authInfo?.methods?.includes("basic") && (
                    <Button onClick={() => handleAuthChoice("basic")}>Basic</Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default AuthChoice;
