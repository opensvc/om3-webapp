import React, {useEffect} from 'react';
import {useOidc} from '../context/OidcAuthContext.tsx';
import logger from '../utils/logger.js';

const SilentRenew = () => {
    const {userManager} = useOidc();

    useEffect(() => {
        const doSigninSilentCallback = async () => {
            try {
                if (userManager && typeof userManager.signinSilentCallback === 'function') {
                    await userManager.signinSilentCallback();
                    logger.info('Silent renew callback processed successfully');
                } else {
                    logger.warn('UserManager or signinSilentCallback unavailable in silent renew context');
                }
            } catch (err) {
                logger.error('Error during signinSilentCallback:', err);
            }
        };

        void doSigninSilentCallback();
    }, [userManager]);

    return <div>Silent renew processing...</div>;
};

export default SilentRenew;
