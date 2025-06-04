import {Link, useNavigate, useLocation} from "react-router-dom";
import {AppBar, Toolbar, Typography, Button, Box} from "@mui/material";
import {FaSignOutAlt, FaUser} from "react-icons/fa";
import {useOidc} from "../context/OidcAuthContext.tsx";
import {useAuth, useAuthDispatch, Logout} from "../context/AuthProvider.jsx";
import {useEffect, useState} from "react";
import useFetchDaemonStatus from "../hooks/useFetchDaemonStatus";

const NavBar = () => {
    const {userManager} = useOidc();
    const navigate = useNavigate();
    const auth = useAuth();
    const location = useLocation();
    const authDispatch = useAuthDispatch();
    const {clusterName, fetchNodes, loading} = useFetchDaemonStatus();
    const [breadcrumb, setBreadcrumb] = useState([]);

    useEffect(() => {
        const fetchClusterData = async () => {
            let retryCount = 0;
            const maxRetries = 3;
            const retryInterval = 1000;

            const tryFetch = async () => {
                const token = auth?.authToken || localStorage.getItem("authToken");

                if (!token) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(tryFetch, retryInterval);
                        return;
                    }
                    setBreadcrumb([
                        {name: "Cluster", path: "/cluster"},
                        ...getPathBreadcrumbs(),
                    ]);
                    return;
                }

                try {
                    await fetchNodes(token);
                } catch (error) {
                    console.error("Error while calling fetchNodes:", error.message);
                }
            };

            const getPathBreadcrumbs = () => {
                const pathParts = location.pathname.split("/").filter(Boolean);
                const breadcrumbItems = [];
                if (pathParts[0] !== "login" && pathParts.length > 1) {
                    pathParts.forEach((part, index) => {
                        const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                        if (part !== "cluster") {
                            breadcrumbItems.push({name: part, path: fullPath});
                        }
                    });
                }
                return breadcrumbItems;
            };

            tryFetch();
        };

        fetchClusterData();
    }, [auth?.authToken, location.pathname]);

    useEffect(() => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        const breadcrumbItems = [];

        if (pathParts[0] !== "login") {
            breadcrumbItems.push({
                name: loading ? "Loading..." : (clusterName || "Cluster"),
                path: "/cluster",
            });

            if (pathParts.length > 1 || (pathParts.length === 1 && pathParts[0] !== "cluster")) {
                pathParts.forEach((part, index) => {
                    const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                    if (part !== "cluster") {
                        breadcrumbItems.push({name: part, path: fullPath});
                    }
                });
            }
        }

        setBreadcrumb(breadcrumbItems);
    }, [location.pathname, clusterName, loading]);

    const handleLogout = () => {
        if (auth?.authChoice === "openid") {
            userManager.signoutRedirect();
            userManager.removeUser();
        }
        localStorage.removeItem("authToken");
        authDispatch({type: Logout});
        navigate("/auth-choice");
    };

    return (
        <AppBar position="sticky">
            <Toolbar sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <Box sx={{display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5}}>
                    {breadcrumb.length > 0 &&
                        breadcrumb.map((item, index) => (
                            <Box key={index} sx={{display: "flex", alignItems: "center"}}>
                                <Typography
                                    component={Link}
                                    to={item.path}
                                    sx={{
                                        color: "inherit",
                                        textDecoration: "none",
                                        fontWeight: 500,
                                        fontSize: "1.1rem",
                                        textTransform: "none",
                                        "&:hover": {
                                            textDecoration: "underline",
                                        },
                                    }}
                                >
                                    {decodeURIComponent(item.name)}
                                </Typography>
                                {index < breadcrumb.length - 1 && (
                                    <Typography sx={{mx: 0.5, fontSize: "1.1rem"}}>{">"}</Typography>
                                )}
                            </Box>
                        ))}
                </Box>

                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                    <Button
                        component={Link}
                        to="/whoami"
                        startIcon={<FaUser/>}
                        sx={{
                            backgroundColor: "primary.main",
                            color: "white",
                            boxShadow: 3,
                            "&:hover": {
                                backgroundColor: "primary.dark",
                            },
                        }}
                    >
                        Who Am I
                    </Button>
                    <Button
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        sx={{
                            backgroundColor: "red",
                            color: "white",
                            boxShadow: 3,
                            "&:hover": {
                                backgroundColor: "darkred",
                            },
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default NavBar;