/* eslint-disable no-unused-vars */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useStateValue } from "../state.js";
import FormControl from "@mui/material/FormControl";
import TextField from "@mui/material/TextField";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

const decodeToken = (token) => {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload;
    } catch (error) {
        console.error("Error while decoding token:", error);
        return null;
    }
};

function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [{ basicLogin }, dispatch] = useStateValue();
    const { t, i18n } = useTranslation();

    // Function to refresh the token
    const refreshToken = async () => {
        console.log("Refreshing token...");
        const token = localStorage.getItem("authToken");

        if (token) {
            try {
                // Make a POST request to get a new token using the current token
                const response = await fetch("/auth/token", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Token refresh failed");
                }

                const data = await response.json();

                // Update the token in localStorage and global state
                localStorage.setItem("authToken", data.token);
                dispatch({ type: "setBasicLogin", data: { ...basicLogin, token: data } });

                // Refresh the token before it expires
                setTimeout(refreshToken, 30 * 1000 - 5000); // Refresh token 5 seconds before expiration
            } catch (error) {
                console.error("Error while refreshing token:", error);
            }
        }
    };

    const handleLogin = async (username, password) => {
        try {
            //const duration = "30s"; // Token duration in seconds

            // Build URL with duration in query string
            //const url = `/auth/token?duration=${duration}`;
            const url = `/auth/token`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": "Basic " + btoa(`${username}:${password}`),
                },
            });

            if (!response.ok) {
                throw new Error("Incorrect username or password");
            }

            const data = await response.json();
            console.log("Token received");

            // Reset error if login succeeds
            setErrorMessage("");

            // Save credentials and token in state
            dispatch({ type: "setBasicLogin", data: { username, password, token: data } });
            localStorage.setItem("authToken", data.token);

            // Decode token to get expiration and calculate refresh time
            const payload = decodeToken(data.token);
            if (payload && payload.exp) {
                const expirationTime = payload.exp * 1000;
                const now = Date.now();
                const refreshTime = expirationTime - now - 5000; // Refresh 5 seconds before expiration

                if (refreshTime > 0) {
                    setTimeout(refreshToken, refreshTime);
                }
            }

            navigate("/nodes");
        } catch (error) {
            console.error("Authentication error:", error);
            setErrorMessage(error.message);
        }
    };

    // Handles form submission
    const handleSubmit = (e) => {
        e.preventDefault();  // Prevents page reload on form submission
        handleLogin(username, password);  // Calls authentication function
    };

    function handleEnterKeyDown(e) {
        if (e.keyCode === 13) {
            handleSubmit(e);
        }
    }

    function handleChangeMethod(e) {
        dispatch({ type: "setAuthChoice", data: "" });
    }

    return (
        <Dialog open={true} aria-labelledby="dialog-title">
            <DialogTitle id="dialog-title">
                {t("Login")}
            </DialogTitle>
            <DialogContent>
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <TextField
                        placeholder={t("Username")}
                        autoFocus={true}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </FormControl>
                <FormControl fullWidth sx={{ mb: 2 }}>
                    <TextField
                        type="password"
                        placeholder={t("Password")}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleEnterKeyDown}
                    />
                </FormControl>

                {/* Display error message if login fails */}
                {errorMessage && (
                    <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                        {errorMessage}
                    </Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleSubmit} disabled={!username || !password} color="primary">
                    {t("Submit")}
                </Button>
                <Button onClick={handleChangeMethod}>
                    {t("Change Method")}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default Login;