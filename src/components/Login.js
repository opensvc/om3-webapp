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
        console.error("Erreur lors du décodage du token:", error);
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

    // Fonction pour renouveler le token
    const refreshToken = async () => {
        console.log("Renouvellement du token...");
        const token = localStorage.getItem("authToken");

        if (token) {
            try {
                // Refaire la requête POST pour obtenir un nouveau token en utilisant le token actuel
                const response = await fetch("/auth/token", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error("Échec du renouvellement du token");
                }

                const data = await response.json();
                console.log("Nouveau token reçu :", data);

                // Mettez à jour le token dans localStorage et dans le state global
                localStorage.setItem("authToken", data.token);
                dispatch({ type: "setBasicLogin", data: { ...basicLogin, token: data } });

                // Renouveler le token avant son expiration
                setTimeout(refreshToken, 30 * 1000 - 5000); // Renouveler le token 5 secondes avant l'expiration
            } catch (error) {
                console.error("Erreur lors du renouvellement du token :", error);
            }
        }
    };

    const handleLogin = async (username, password) => {
        console.log("handleLogin a été appelée avec :", username, password);
        try {
            console.log("Tentative d'authentification avec :", username, password);

            //const duration = "30s"; // Durée du token en secondes

            // Construire l'URL avec la durée dans la query string
            //const url = `/auth/token?duration=${duration}`;
            const url = `/auth/token`;

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": "Basic " + btoa(`${username}:${password}`),
                },
            });

            console.log("Réponse brute de l'API :", response);

            if (!response.ok) {
                throw new Error("Nom d'utilisateur ou mot de passe incorrect");
            }

            const data = await response.json();
            console.log("Token reçu :", data);

            // Réinitialiser l'erreur si la connexion réussit
            setErrorMessage("");

            // Sauvegarde les identifiants et le token dans le state
            dispatch({ type: "setBasicLogin", data: { username, password, token: data } });
            localStorage.setItem("authToken", data.token);

            // Décoder le token pour récupérer l'expiration et calculer le rafraîchissement
            const payload = decodeToken(data.token);
            if (payload && payload.exp) {
                const expirationTime = payload.exp * 1000;
                const now = Date.now();
                const refreshTime = expirationTime - now - 5000; // Rafraîchir 5 secondes avant l'expiration

                if (refreshTime > 0) {
                    setTimeout(refreshToken, refreshTime);
                }
            }

            navigate("/nodes");
        } catch (error) {
            console.error("Erreur d'authentification :", error);
            setErrorMessage(error.message);
        }
    };


    // Gère l'envoi du formulaire
    const handleSubmit = (e) => {
        e.preventDefault();  // Empêche le rechargement de la page lors de l'envoi du formulaire
        handleLogin(username, password);  // Appelle la fonction d'authentification
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

                {/* Afficher le message d'erreur si le login échoue */}
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
