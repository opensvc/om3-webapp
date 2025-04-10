import React from "react";
import {useStateValue} from "../state";
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
import {FaKey, FaIdCard, FaUserShield} from "react-icons/fa";

function AuthChoice() {
    const [state, dispatch] = useStateValue();
    const {authInfo} = state;

    const handleAuthChoice = (choice) => {
        dispatch({type: "setAuthChoice", data: choice});
    };

    return (
        <Dialog open={true} maxWidth="xs" fullWidth>
            <DialogTitle>
                <Typography variant="h6" fontWeight="bold" textAlign="center">
                    Authentication Methods
                </Typography>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" textAlign="center" color="textSecondary" gutterBottom>
                    Please select one of the authentication methods the cluster advertises.
                </Typography>
                <Stack spacing={2} mt={2}>
                    {authInfo?.openid?.well_known_uri && (
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
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<FaIdCard/>}
                        fullWidth
                        onClick={() => handleAuthChoice("x509")}
                    >
                        x509 Certificate
                    </Button>
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
