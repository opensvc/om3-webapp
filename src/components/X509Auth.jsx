export const authenticateWithX509 = async (navigate) => {
    try {
        // Make an API call to the whoami endpoint, which should trigger the browser's certificate prompt
        const response = await fetch("https://localhost:1215/api/auth/whoami", {
            method: "GET",
            credentials: "include", // Ensure credentials (like certificates) are sent
            headers: {
                "Accept": "application/json",
            },
        });

        if (response.ok) {
            const data = await response.json();
            // Assuming the response contains a token or user info
            const token = data.token; // Adjust based on your API response
            if (token) {
                localStorage.setItem("authToken", token);
                navigate("/cluster"); // Redirect to a protected route
                return { success: true };
            } else {
                throw new Error("No token received from x509 authentication");
            }
        } else {
            throw new Error(`x509 authentication failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error during x509 authentication:", error);
        return { success: false, error: error.message };
    }
};