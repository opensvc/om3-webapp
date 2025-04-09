import {Link, useNavigate} from "react-router-dom";
import {AppBar, Toolbar, Typography, Button, Box} from "@mui/material";
import {FaSignOutAlt} from "react-icons/fa";

const NavBar = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("authToken");
        navigate("/login");
    };

    return (
        <AppBar position="sticky">
            <Toolbar>
                <Typography variant="h6" sx={{flexGrow: 1}}>
                    OM3
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center'}}>
                    <Button color="inherit" component={Link} to="/nodes">
                        Nodes
                    </Button>
                    <Button color="inherit" component={Link} to="/objects">
                        Objects
                    </Button>
                    <Button
                        color="error"
                        startIcon={<FaSignOutAlt/>}
                        onClick={handleLogout}
                        sx={{boxShadow: 3}}
                    >
                        Logout
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default NavBar;
