import React, {createContext, useContext, useState} from "react";
import {UserManager, UserManagerSettings} from "oidc-client-ts";

export interface OidcContextType {
    userManager: UserManager;
    recreateUserManager: (settings: UserManagerSettings) => void;
}

const OidcContext = createContext<OidcContextType | null>(null);

export const OidcProvider = ({children}: { children: React.ReactNode }) => {
    // Store the UserManager instance in state
    const [userManager, setUserManager] = useState(null as unknown as UserManager);

    const recreateUserManager = (settings: UserManagerSettings) => {
        // Clean up the old UserManager instance
        cleanupUserManager(userManager);
        // Create and set a new UserManager
        const newUserManager = new UserManager(settings);
        setUserManager(newUserManager);
    };

    return (
        <OidcContext.Provider value={{userManager, recreateUserManager}}>
            {children}
        </OidcContext.Provider>
    );
};

// Hook to use the UserManager from Context
export const useOidc = () => {
    const context = useContext(OidcContext);
    if (!context) {
        throw new Error("useOidc must be used within an OidcProvider");
    }
    return context;
};

// Cleanup function to dispose of UserManager events
export function cleanupUserManager(userManager: UserManager) {
    if (!userManager) return;
    userManager.events.removeUserLoaded(() => {
    });
    userManager.events.removeUserUnloaded(() => {
    });
    userManager.events.removeAccessTokenExpired(() => {
    });
    userManager.events.removeAccessTokenExpiring(() => {
    });
    userManager.events.removeSilentRenewError(() => {
    });
    userManager.clearStaleState();
}
