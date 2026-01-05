import React, {createContext, useContext, useState, useRef, useEffect} from "react";
import {UserManager, UserManagerSettings, Log} from "oidc-client-ts";
import logger from "../utils/logger.js";

export interface OidcContextType {
    userManager: UserManager | null;
    recreateUserManager: (settings: UserManagerSettings) => void;
    isInitialized: boolean;
}

const OidcContext = createContext<OidcContextType | null>(null);

export const OidcProvider = ({children}: { children: React.ReactNode }) => {
    const [userManager, setUserManager] = useState<UserManager | null>(null);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const userManagerRef = useRef<UserManager | null>(null);

    const recreateUserManager = (settings: UserManagerSettings) => {
        logger.info("Recreating UserManager with settings:", settings);
        cleanupUserManager(userManagerRef.current);
        // Ensure oidc-client-ts has verbose logging during development
        try {
            (Log as any).logger = console;
            (Log as any).level = (Log as any).DEBUG;
        } catch (e) {
            logger.debug('Failed to configure oidc-client-ts Log:', e);
        }

        const newUserManager = new UserManager(settings);
        // Expose globally for legacy modules that rely on window.oidcUserManager
        try {
            (window as any).oidcUserManager = newUserManager;
        } catch (e) {
            logger.debug('Unable to set window.oidcUserManager:', e);
        }
        setUserManager(newUserManager);
        userManagerRef.current = newUserManager;
        setIsInitialized(true);
    };

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            cleanupUserManager(userManagerRef.current);
            try {
                delete (window as any).oidcUserManager;
            } catch (e) {
                logger.debug('Unable to delete window.oidcUserManager during cleanup:', e);
            }
        };
    }, []);

    return (
        <OidcContext.Provider value={{userManager, recreateUserManager, isInitialized}}>
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
export function cleanupUserManager(userManager: UserManager | null) {
    if (!userManager) return;
    logger.debug("Cleaning up UserManager events");
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
    userManager.clearStaleState()
        .catch(error => {
            logger.debug('Error during clearStaleState:', error);
        });
}
