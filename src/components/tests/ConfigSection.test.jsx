import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ConfigSection from '../ConfigSection';
import userEvent from '@testing-library/user-event';
import {URL_OBJECT, URL_NODE} from '../../config/apiPath.js';
import {within} from '@testing-library/react';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Accordion: ({children, expanded, onChange, ...props}) => (
            <div data-testid="accordion" className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, expanded, ...props}) => (
            <div
                role="button"
                data-testid="accordion-summary"
                aria-expanded={expanded ? 'true' : 'false'}
                onClick={() => onChange?.({}, !expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => (
            <div data-testid="accordion-details" {...props}>
                {children}
            </div>
        ),
        Dialog: ({children, open, maxWidth, fullWidth, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Snackbar: ({children, open, autoHideDuration, ...props}) =>
            open ? <div role="alertdialog" {...props}>{children}</div> : null,
        Alert: ({children, severity, ...props}) => (
            <div role="alert" data-severity={severity} {...props}>
                {children}
            </div>
        ),
        Button: ({children, onClick, disabled, variant, component, htmlFor, ...props}) => (
            <button
                onClick={onClick}
                disabled={disabled}
                data-variant={variant}
                {...(component === 'label' ? {htmlFor} : {})}
                {...props}
            >
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, multiline, rows, ...props}) => (
            <input
                type={multiline ? 'text' : 'text'}
                placeholder={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                {...(multiline ? {'data-multiline': true, rows} : {})}
                {...props}
                aria-label={label}
            />
        ),
        Input: ({type, onChange, disabled, ...props}) => (
            <input type={type} onChange={onChange} disabled={disabled} {...props} />
        ),
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn((key) => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('ConfigSection Component', () => {
    const user = userEvent.setup();
    const setConfigNode = jest.fn();
    const openSnackbar = jest.fn();

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();

        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        global.fetch = jest.fn((url) => {
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve(`
[DEFAULT]
nodes = *
orchestrate = ha
id = 0bfea9c4-0114-4776-9169-d5e3455cee1f
long_line = this_is_a_very_long_unbroken_string_that_should_trigger_a_horizontal_scrollbar_abcdefghijklmnopqrstuvwxyz1234567890
[fs#1]
type = flag
                    `),
                    json: () => Promise.resolve({}),
                });
            }
            if (url.includes('/config?set=') || url.includes('/config?unset=') || url.includes('/config?delete=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve(''),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('displays configuration with horizontal scrolling', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const accordionSummary = screen.getByTestId('accordion-summary');
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByText(/nodes = \*/i)).toBeInTheDocument();
            expect(screen.getByText(/orchestrate = ha/i)).toBeInTheDocument();
            expect(screen.getByText(/type = flag/i)).toBeInTheDocument();
        }, {timeout: 10000});

        const accordionDetails = screen.getByTestId('accordion-details');
        const scrollableBox = accordionDetails.querySelector('div[style*="overflow-x: auto"]') ||
            accordionDetails.querySelector('pre')?.parentElement;

        expect(scrollableBox).toBeInTheDocument();
        expect(scrollableBox).toHaveStyle({'overflow-x': 'auto'});

        const preElement = within(scrollableBox).getByText(
            /long_line = this_is_a_very_long_unbroken_string/
        );
        expect(preElement).toBeInTheDocument();
    }, 15000);

    test('displays error when fetching configuration fails', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: false,
                status: 500,
                text: () => Promise.resolve('Server error'),
            })
        );

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const accordionSummary = screen.getByTestId('accordion-summary');
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Failed to fetch config: HTTP 500/i);
        }, {timeout: 10000});
    });

    test('displays loading indicator while fetching configuration', async () => {
        global.fetch.mockImplementation(() => new Promise(() => {
        })); // Simulates a pending request

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const accordionSummary = screen.getByTestId('accordion-summary');
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        }, {timeout: 5000});
    });

    test('displays no configuration when configNode is missing', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const accordionSummary = screen.getByTestId('accordion-summary');
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/No node available to fetch configuration/i);
        }, {timeout: 5000});

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('updates configuration file successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const accordionSummary = screen.getByTestId('accordion-summary');
        await act(async () => {
            await user.click(accordionSummary);
        });

        const uploadButton = screen.getByRole('button', {name: /Upload new configuration file/i});
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['[DEFAULT]\nnodes = node2'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        expect(screen.getByText('config.ini')).toBeInTheDocument();

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info');
            expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        'Content-Type': 'application/octet-stream',
                    }),
                    body: testFile,
                })
            );
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles update config with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const uploadButton = screen.getByRole('button', {name: /Upload new configuration file/i});
        await act(async () => {
            await user.click(uploadButton);
        });

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['new config content'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleUpdateConfig] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('handles update config with missing file', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const uploadButton = screen.getByRole('button', {name: /Upload new configuration file/i});
        await act(async () => {
            await user.click(uploadButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Configuration/i);
        }, {timeout: 5000});

        const updateButton = screen.getByRole('button', {name: /Update/i});
        expect(updateButton).toBeDisabled();

        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
            expect.any(Object)
        );
    });

    test('handles update config with missing token', async () => {
        mockLocalStorage.getItem.mockReturnValueOnce(null);
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const uploadButton = screen.getByRole('button', {name: /Upload new configuration file/i});
        await act(async () => {
            await user.click(uploadButton);
        });

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['new config content'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating configuration…', 'info');
            expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully');
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config/file`),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles add params with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const paramInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(paramInput, 'test.param=value');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleAddParams] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('handles add params with invalid format', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const paramInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(paramInput, 'test.param');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                'Invalid format for parameter: test.param. Use \'key=value\'.',
                'error'
            );
            expect(global.fetch).not.toHaveBeenCalledWith(
                expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?set=`),
                expect.any(Object)
            );
        }, {timeout: 5000});
    });

    test('deletes configuration sections successfully', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const deleteInput = within(dialog).getByLabelText('Section keys to delete');
        await act(async () => {
            await user.type(deleteInput, 'fs#1');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config?delete=fs%231`),
                expect.objectContaining({
                    method: 'PATCH',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                    }),
                })
            );
            expect(openSnackbar).toHaveBeenCalledWith('Successfully deleted 1 section(s)', 'success');
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_NODE}/node1/instance/path/root/cfg/cfg1/config/file`),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('cancels manage params dialog', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const setInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(setInput, 'test.param=value');
        });

        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            expect(global.fetch).not.toHaveBeenCalledWith(
                expect.stringContaining(`${URL_OBJECT}/root/cfg/cfg1/config`),
                expect.any(Object)
            );
        }, {timeout: 5000});
    });

    test('logs warning when updating config with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const uploadButton = screen.getByRole('button', {name: /Upload new configuration file/i});
        await act(async () => {
            await user.click(uploadButton);
        });

        const fileInput = document.querySelector('#update-config-file-upload');
        const testFile = new File(['new config content'], 'config.ini');
        await act(async () => {
            await user.upload(fileInput, testFile);
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleUpdateConfig] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Configuration updated successfully');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('logs warning when adding params with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const paramInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(paramInput, 'test.param=value');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleAddParams] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Successfully added 1 parameter(s)', 'success');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('logs warning when unsetting params with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const unsetInput = within(dialog).getByLabelText('Parameter keys to unset');
        await act(async () => {
            await user.type(unsetInput, 'test.param');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleUnsetParams] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Successfully unset 1 parameter(s)', 'success');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('logs warning when deleting params with missing configNode', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const deleteInput = within(dialog).getByLabelText('Section keys to delete');
        await act(async () => {
            await user.type(deleteInput, 'fs#1');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '⚠️ [handleDeleteParams] No configNode available for root/cfg/cfg1'
            );
            expect(openSnackbar).toHaveBeenCalledWith('Successfully deleted 1 section(s)', 'success');
        }, {timeout: 10000});

        consoleWarnSpy.mockRestore();
    });

    test('parses object path with edge cases', async () => {
        render(
            <ConfigSection
                decodedObjectName={null}
                configNode=""
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('No node available to fetch configuration');
        }, {timeout: 5000});

        render(
            <ConfigSection
                decodedObjectName="cluster"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining(`${URL_NODE}/node1/instance/path/root/ccfg/cluster/config/file`),
                expect.any(Object)
            );
        }, {timeout: 10000});
    });

    test('handles fetch failure when adding parameters', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config?set=')) {
                return Promise.resolve({
                    ok: false,
                    status: 500,
                    text: () => Promise.resolve('Server error'),
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            });
        });

        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const paramInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(paramInput, 'test.param=value');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                'Error adding parameter test.param: Failed to add parameter test.param: 500',
                'error'
            );
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});
    });

    test('handles empty parameter inputs', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            await user.click(manageButton);
        });

        const dialog = screen.getByRole('dialog');
        const paramInput = within(dialog).getByLabelText('Parameters to set');
        await act(async () => {
            await user.type(paramInput, '  \n  ');
        });

        const applyButton = within(dialog).getByRole('button', {name: /Apply/i});
        await act(async () => {
            await user.click(applyButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('No valid parameters provided.', 'error');
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 5000});
    });

    test('debounces fetchConfig calls', async () => {
        render(
            <ConfigSection
                decodedObjectName="root/cfg/cfg1"
                configNode="node1"
                setConfigNode={setConfigNode}
                openSnackbar={openSnackbar}
            />
        );

        await act(async () => {
            setConfigNode('node1');
            setConfigNode('node1');
            setConfigNode('node1');
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        }, {timeout: 2000});
    });
});
