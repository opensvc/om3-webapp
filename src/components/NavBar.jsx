import {Link, useNavigate, useLocation} from "react-router-dom";
import {AppBar, Toolbar, Typography, Button, Box} from "@mui/material";
import {FaSignOutAlt} from "react-icons/fa";
import {useOidc} from "../context/OidcAuthContext.js";
import {useAuth, useAuthDispatch, Logout} from "../context/AuthProvider.jsx";

const NavBar = () => {
    const {userManager} = useOidc();
    const navigate = useNavigate();
    const auth = useAuth()
    const location = useLocation();
    const authDispatch = useAuthDispatch()

    const handleLogout = () => {
        if (auth?.authChoice === "openid") {
            userManager.signoutRedirect();
            userManager.removeUser();
        }
        localStorage.removeItem("authToken");
        authDispatch({type: Logout})
        navigate("/auth-choice");
    };{}

    const getBreadcrumbItems = () => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        const breadcrumbItems = [];

        if (pathParts[0] === "login") {
            return breadcrumbItems;
        }

        if (pathParts.length === 1 && pathParts[0] === "cluster") {
            breadcrumbItems.push({name: "Cluster", path: "/cluster"});
        } else {
            breadcrumbItems.push({name: "Cluster", path: "/cluster"});

            pathParts.forEach((part, index) => {
                const fullPath = "/" + pathParts.slice(0, index + 1).join("/");
                if (part !== "cluster") {
                    breadcrumbItems.push({name: part, path: fullPath});
                }
            });
        }

        return breadcrumbItems;
    };

    const breadcrumb = getBreadcrumbItems();

    return (
        <AppBar position="sticky">
            <Toolbar sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                <Box sx={{display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5}}>
                    {breadcrumb.length > 0 && breadcrumb.map((item, index) => (
                        <Box key={index} sx={{display: "flex", alignItems: "center"}}>
                            <Typography
                                component={Link}
                                to={item.path}
                                sx={{
                                    color: "inherit",
                                    textDecoration: "none",
                                    fontWeight: 500,
                                    fontSize: "1.1rem",
                                    textTransform: "capitalize",
                                    '&:hover': {
                                        textDecoration: "underline"
                                    }
                                }}
                            >
                                {item.name}
                            </Typography>
                            {index < breadcrumb.length - 1 && (
                                <Typography sx={{mx: 0.5, fontSize: "1.1rem"}}>{">"}</Typography>
                            )}
                        </Box>
                    ))}
                </Box>

                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                    <Button
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        sx={{
                            backgroundColor: 'red',
                            color: 'white',
                            boxShadow: 3,
                            '&:hover': {
                                backgroundColor: 'darkred',
                            }
                        }}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default NavBar;
