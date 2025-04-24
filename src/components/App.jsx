/* eslint-disable no-unused-vars */

import React, {useEffect, useState} from "react";
import {BrowserRouter as Router, Routes, Route, Navigate, useLocation} from "react-router-dom";
import OidcCallback from "./OidcCallback";
import AuthChoice from "./Authchoice.jsx";
import Login from "./Login.jsx";
import '../styles/main.css';
import NodesTable from "./NodesTable";
import Objects from "./Objects";
import ObjectDetails from "./ObjectDetails";
import ClusterOverview from "./Cluster";
import NavBar from './NavBar';
import Namespaces from "./Namespaces";
import Heartbeats from "./Heartbeats";
import Pools from "./Pools";
import {OidcProvider} from "../context/OidcAuthContext.js";
import {AuthProvider} from "../context/AuthProvider.jsx";


let enabled;

const isTokenValid = (token) => {
    if (!token) return false;

    try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const now = Date.now() / 1000;
        return payload.exp > now;
    } catch (error) {
        console.error("Error while verifying token:", error);
        return false;
    }
};

const ProtectedRoute = ({children}) => {
    const token = localStorage.getItem("authToken");

    if (!isTokenValid(token)) {
        console.log("Invalid or expired token, redirecting to /auth-choice");
        localStorage.removeItem("authToken");
        return <Navigate to="/auth-choice" replace/>;
    }

    return children;
};

const App = () => {
    console.log("App init");
    const [token, setToken] = useState(localStorage.getItem("authToken") || null);

    useEffect(() => {
        const checkTokenChange = () => {
            const newToken = localStorage.getItem("authToken");
            if (newToken !== token) {
                setToken(newToken);
            }
        };

        window.addEventListener("storage", checkTokenChange);
        return () => window.removeEventListener("storage", checkTokenChange);
    }, [token]);

    return (
        <AuthProvider>
            <OidcProvider>
                <Router>
                    <NavBar/>
                    <Routes>
                        <Route path="/" element={<Navigate to="/cluster" replace/>}/>
                        <Route path="/cluster" element={<ProtectedRoute><ClusterOverview/></ProtectedRoute>}/>
                        <Route path="/namespaces" element={<ProtectedRoute><Namespaces/></ProtectedRoute>}/>
                        <Route path="/heartbeats" element={<Heartbeats/>}/>
                        <Route path="/nodes" element={<ProtectedRoute><NodesTable/></ProtectedRoute>}/>
                        <Route path="/pools" element={<ProtectedRoute><Pools /></ProtectedRoute>} />
                        <Route path="/objects" element={<ProtectedRoute><Objects/></ProtectedRoute>}/>
                        <Route path="/objects/:objectName" element={<ProtectedRoute><ObjectDetails/></ProtectedRoute>}/>
                        <Route path="/auth-callback" element={<OidcCallback/>}/>
                        <Route path="/auth-choice" element={<AuthChoice/>}/>
                        <Route path="/auth/login" element={<Login/>}/>
                        <Route path="*" element={<Navigate to="/"/>}/>
                    </Routes>
                </Router>
            </OidcProvider>
        </AuthProvider>
    )
};

export default App;