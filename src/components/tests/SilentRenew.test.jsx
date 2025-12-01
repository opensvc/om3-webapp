import React from 'react';
import {render, waitFor, screen} from '@testing-library/react';
import {useOidc} from '../../context/OidcAuthContext.tsx';
import logger from '../../utils/logger.js';
import SilentRenew from '../SilentRenew';

// Mocks
jest.mock('../../context/OidcAuthContext.tsx');
jest.mock('../../utils/logger.js');

describe('SilentRenew', () => {
    const mockUserManager = {
        signinSilentCallback: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('render default processing message', () => {
        useOidc.mockReturnValue({userManager: mockUserManager});

        render(<SilentRenew/>);

        expect(screen.getByText('Silent renew processing...')).toBeInTheDocument();
    });

    test('call signinSilentCallback on component mount', async () => {
        useOidc.mockReturnValue({userManager: mockUserManager});

        render(<SilentRenew/>);

        await waitFor(() => {
            expect(mockUserManager.signinSilentCallback).toHaveBeenCalledTimes(1);
        });
    });

    test('log success when signinSilentCallback succeeds', async () => {
        useOidc.mockReturnValue({userManager: mockUserManager});
        mockUserManager.signinSilentCallback.mockResolvedValue(undefined);

        render(<SilentRenew/>);

        await waitFor(() => {
            expect(logger.info).toHaveBeenCalledWith('Silent renew callback processed successfully');
        });
    });

    test('log warning if userManager is unavailable', async () => {
        useOidc.mockReturnValue({userManager: null});

        render(<SilentRenew/>);

        await waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'UserManager or signinSilentCallback unavailable in silent renew context'
            );
        });
    });

    test('log warning if signinSilentCallback is not a function', async () => {
        useOidc.mockReturnValue({
            userManager: {signinSilentCallback: 'not-a-function'}
        });

        render(<SilentRenew/>);

        await waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'UserManager or signinSilentCallback unavailable in silent renew context'
            );
        });
    });

    test('log error if signinSilentCallback fails', async () => {
        useOidc.mockReturnValue({userManager: mockUserManager});
        const testError = new Error('Test error');
        mockUserManager.signinSilentCallback.mockRejectedValue(testError);

        render(<SilentRenew/>);

        await waitFor(() => {
            expect(logger.error).toHaveBeenCalledWith(
                'Error during signinSilentCallback:',
                testError
            );
        });
    });

    test('do not call signinSilentCallback if userManager changes', () => {
        const {rerender} = render(<SilentRenew/>);

        expect(mockUserManager.signinSilentCallback).toHaveBeenCalledTimes(1);

        // Simulate userManager change
        rerender(<SilentRenew/>);

        // Verify that signinSilentCallback is not called again
        expect(mockUserManager.signinSilentCallback).toHaveBeenCalledTimes(1);
    });
});
