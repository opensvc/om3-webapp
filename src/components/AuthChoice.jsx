import React, {useEffect} from "react";
import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Box,
    Typography,
    Stack
} from "@mui/material";
import {FaKey, FaUserShield} from "react-icons/fa";
import useAuthInfo from "../hooks/AuthInfo.jsx";
import oidcConfiguration from "../config/oidcConfiguration.js";
import {useNavigate} from "react-router-dom";
import {useOidc} from "../context/OidcAuthContext.tsx";

function AuthChoice() {
    const {userManager, recreateUserManager} = useOidc();
    const authInfo = useAuthInfo();
    const navigate = useNavigate();

    const handleAuthChoice = async (choice) => {
        if (choice === "openid") {
            if (!userManager) {
                console.log("handleAuthChoice openid skipped: can't create userManager");
                return;
            }
            try {
                await userManager.signinRedirect();
            } catch (err) {
                console.error("handleAuthChoice signinRedirect:", err);
            }
        } else if (choice === "basic") {
            return navigate('/auth/login');
        }
    };

    useEffect(() => {
        if (authInfo?.openid?.issuer && !userManager) {
            (async () => {
                try {
                    const config = await oidcConfiguration(authInfo);
                    recreateUserManager(config);
                } catch (error) {
                    console.error("Failed to initialize OIDC config:", error);
                }
            })();
        }
    }, [authInfo, recreateUserManager, userManager]);

    return (
        <Dialog open={true} maxWidth="xs" fullWidth>
            <DialogTitle>
                <Typography fontWeight="bold" textAlign="center">
                    Authentication Methods
                </Typography>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" textAlign="center" color="textSecondary" gutterBottom>
                    Please select one of the authentication methods the cluster advertises.
                </Typography>
                <Stack spacing={2} mt={2}>
                    {authInfo?.openid?.issuer && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<FaKey/>}
                            fullWidth
                            onClick={() => handleAuthChoice("openid")}
                        >
                            OpenID
                        </Button>
                    )}
                    {authInfo?.methods?.includes("basic") && (
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<FaUserShield/>}
                            fullWidth
                            onClick={() => handleAuthChoice("basic")}
                        >
                            Login
                        </Button>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Box flexGrow={1}/>
            </DialogActions>
        </Dialog>
    );
}

export default AuthChoice;