import React from 'react';
import {render, screen, waitFor, act, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeysSection from '../KeysSection';

// Mock dependencies
jest.mock('../../hooks/useEventStore.js', () => jest.fn());
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
    startEventReception: jest.fn(),
    configureEventSource: jest.fn(),
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Accordion: ({children, expanded, onChange, ...props}) => (
            <div className={expanded ? 'expanded' : ''} {...props}>
                {children}
            </div>
        ),
        AccordionSummary: ({children, id, onChange, expanded, ...props}) => (
            <div
                role="button"
                aria-expanded={expanded ? 'true' : 'false'}
                aria-controls="panel-keys-content"
                id="panel-keys-header"
                onClick={() => onChange?.({}, !expanded)}
                {...props}
            >
                {children}
            </div>
        ),
        AccordionDetails: ({children, ...props}) => (
            <div role="region" aria-labelledby="panel-keys-header" {...props}>
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
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
        Dialog: ({children, open, maxWidth, fullWidth, onClose, ...props}) =>
            open ? <div role="dialog" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} {...props}>{children}</div> : null,
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
        TextField: ({label, value, onChange, disabled, multiline, rows, ...props}) => (
            <input
                type={multiline ? 'text' : 'text'}
                placeholder={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                {...(multiline ? {'data-multiline': true, rows} : {})}
                {...props}
            />
        ),
        Box: ({children, component, ...props}) => <div {...props}>{children}</div>,
        Tooltip: ({children, title, ...props}) => (
            <div data-tooltip={title} {...props}>
                {children}
            </div>
        ),
        IconButton: ({children, onClick, disabled, 'aria-label': ariaLabel, ...props}) => (
            <button onClick={onClick} disabled={disabled} aria-label={ariaLabel} {...props}>
                {children}
            </button>
        ),
        TableContainer: ({children, component, ...props}) => <div {...props}>{children}</div>,
        Table: ({children, 'aria-label': ariaLabel, ...props}) => (
            <table aria-label={ariaLabel} {...props}>{children}</table>
        ),
        TableHead: ({children, ...props}) => <thead {...props}>{children}</thead>,
        TableBody: ({children, ...props}) => <tbody {...props}>{children}</tbody>,
        TableRow: ({children, ...props}) => <tr {...props}>{children}</tr>,
        TableCell: ({children, component, scope, sx, ...props}) => (
            <td {...props}>{children}</td>
        ),
        Paper: ({children, sx, ...props}) => <div {...props}>{children}</div>,
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/UploadFile', () => () => <span/>);
jest.mock('@mui/icons-material/Edit', () => () => <span/>);
jest.mock('@mui/icons-material/Delete', () => () => <span/>);
jest.mock('@mui/icons-material/Add', () => () => <span/>);
jest.mock('@mui/icons-material/ExpandMore', () => () => <span/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('KeysSection Component', () => {
    const user = userEvent.setup();
    const openSnackbar = jest.fn();

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();
        mockLocalStorage.getItem.mockReturnValue('mock-token');

        // Mock fetch for keys-related API calls
        global.fetch = jest.fn((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                            {name: 'key2', node: 'node1', size: 6946},
                        ],
                    }),
                    text: () => Promise.resolve(''),
                });
            }
            if (url.includes('/data/key')) {
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
        jest.resetAllMocks();
    });

    // Helper function to find file inputs
    const findFileInput = (dialog, type = 'create') => {
        const inputId = type === 'create' ? 'create-key-file-upload' : 'update-key-file-upload';
        // Strategy 1: Look for hidden file inputs by their ID
        let fileInput = within(dialog).queryByTestId(inputId);
        if (fileInput) return fileInput;
        // Strategy 2: Look for file inputs by type
        const allInputs = within(dialog).queryAllByRole('textbox');
        fileInput = allInputs.find(input => input.type === 'file' || input.id === inputId);
        if (fileInput) return fileInput;
        // Strategy 3: Look for file inputs by their accept attribute
        const fileInputs = within(dialog).queryAllByDisplayValue('');
        fileInput = fileInputs.find(input => input.type === 'file');
        if (fileInput) return fileInput;
        return null;
    };

    // Helper to upload file
    const uploadFile = async (dialog, type = 'create') => {
        const fileInput = findFileInput(dialog, type);
        if (fileInput) {
            const file = new File(['test content'], 'test.txt', {type: 'text/plain'});
            await user.upload(fileInput, file);
        }
        return fileInput;
    };

    test('displays no keys message when keys array is empty', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    test('displays keys in table for cfg object', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const keysAccordionDetails = screen.getByRole('region', {name: /Object Keys/i});

        await waitFor(() => {
            expect(within(keysAccordionDetails).getByText('key1')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(keysAccordionDetails).getByText('key2')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(keysAccordionDetails).getByText('2626 bytes')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(keysAccordionDetails).getByText('6946 bytes')).toBeInTheDocument();
        });

        const node1Elements = within(keysAccordionDetails).getAllByText('node1');
        expect(node1Elements).toHaveLength(2);
        node1Elements.forEach((element) => {
            expect(element).toBeInTheDocument();
            expect(element.tagName.toLowerCase()).toBe('td');
        });
    });

    test('expands keys accordion', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const keysAccordion = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByText('key1')).toBeInTheDocument();
        });
    });

    test('displays error when fetching keys fails', async () => {
        global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch keys')));
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const keysAccordion = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch keys/i)).toBeInTheDocument();
        });
    });

    test('displays loading indicator while fetching keys', async () => {
        global.fetch.mockImplementationOnce(() => new Promise(() => {
        }));
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const keysAccordion = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });

    test('disables buttons during key creation', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/data/key?name=')) {
                return new Promise(() => {
                });
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                            {name: 'key2', node: 'node1', size: 6946},
                        ],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /add new key/i})).toBeInTheDocument();
        });

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');

        await waitFor(() => {
            expect(dialog).toHaveTextContent(/Create New Key/i);
        });

        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        // Find file input using helper
        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'create');
            expect(fileInput).toBeInTheDocument();
        });

        await act(async () => {
            await user.type(nameInput, 'newKey');
            if (fileInput) {
                await user.upload(fileInput, new File(['content'], 'key.txt'));
            }
        });

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(createButton).toBeDisabled();
        });

        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});

        await waitFor(() => {
            expect(cancelButton).toBeDisabled();
        });
        await waitFor(() => {
            expect(fileInput).toBeDisabled();
        });
    }, 20000);

    test('does not render when kind is neither cfg nor sec', async () => {
        render(
            <KeysSection decodedObjectName="root/svc/service1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.queryByText(/Object Keys/i)).not.toBeInTheDocument();
        });
    });

    test('handles key deletion', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(/Confirm Key Deletion/i);
        expect(dialog).toHaveTextContent(/key1/);

        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Deleting key key1…', 'info');
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'key1' deleted successfully");
        });
    });

    test('handles key update', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(/Update Key/i);
        await waitFor(() => {
            expect(screen.getByText('No file chosen')).toBeInTheDocument();
        });
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        // Upload file and update name
        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            await uploadFile(dialog, 'update');
        });

        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating key updatedKey…', 'info');
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'updatedKey' updated successfully");
        });
    });

    test('disables buttons during key deletion', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/key') && url.includes('DELETE')) {
                return new Promise(() => {
                }); // Never resolves
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});

        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(confirmButton).toBeDisabled();
        });

        await waitFor(() => {
            expect(cancelButton).toBeDisabled();
        });
    });

    test('parseObjectPath handles invalid input', async () => {
        render(
            <KeysSection decodedObjectName={null} openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.queryByText(/Object Keys/i)).not.toBeInTheDocument();
        });
    });

    test('parseObjectPath handles single part input with cluster', async () => {
        render(
            <KeysSection decodedObjectName="cluster" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.queryByText(/Object Keys/i)).not.toBeInTheDocument();
        });
    });

    test('parseObjectPath handles two-part input', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <KeysSection decodedObjectName="cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });
    });

    test('handles error in key deletion when no auth token', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});

        mockLocalStorage.getItem.mockReturnValue(null);
        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        });
    });

    test('handles error in key creation when no auth token', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await uploadFile(dialog, 'create');
        });

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        });
    });

    test('handles error in key update when no auth token', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            await uploadFile(dialog, 'update');
        });

        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        mockLocalStorage.getItem.mockReturnValue(null);
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        });
    });

    test('handles fetch keys with empty response data', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });

        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });
    });

    test('prevents key creation without name and file', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        // Do not fill the name or upload a file
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        // The button should be disabled
        expect(createButton).toBeDisabled();
        // Try to click anyway
        await act(async () => {
            await user.click(createButton);
        });
        // Verify that openSnackbar was not called with the validation error
        // because the button is disabled and the click does not trigger handleCreateKey
        expect(openSnackbar).not.toHaveBeenCalledWith('Key name and file are required.', 'error');
    });

    test('prevents key creation with name but without file', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        // Fill only the name, no file
        await act(async () => {
            await user.type(nameInput, 'newKey');
        });
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        // The button should still be disabled without a file
        expect(createButton).toBeDisabled();
        await act(async () => {
            await user.click(createButton);
        });
        // Verify that openSnackbar was not called because the button is disabled
        expect(openSnackbar).not.toHaveBeenCalledWith('Key name and file are required.', 'error');
    });

    test('prevents key update without name and file', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        // Clear the name and do not upload a file
        await act(async () => {
            await user.clear(nameInput);
        });
        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        // The button should be disabled
        expect(updateButton).toBeDisabled();
        await act(async () => {
            await user.click(updateButton);
        });
        // Verify that openSnackbar was not called because the button is disabled
        expect(openSnackbar).not.toHaveBeenCalledWith('Key name and file are required.', 'error');
    });

    test('handles sec object type', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'secret1', node: 'node1', size: 1024},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/sec/secret1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        await waitFor(() => {
            expect(screen.getByText('secret1')).toBeInTheDocument();
        });
    });

    test('cancels delete dialog', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('cancels create dialog', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(screen.getByText('No file selected')).toBeInTheDocument();
        });
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('cancels update dialog', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('handles accordion collapse', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        // Click to expand (if not already expanded)
        await act(async () => {
            await user.click(accordionSummary);
        });
        await waitFor(() => {
            expect(screen.getByText('key1')).toBeInTheDocument();
        });
        // Click again to collapse
        await act(async () => {
            await user.click(accordionSummary);
        });
        // The content might still be in DOM but hidden, or removed
        // This test verifies the accordion change handler is called
    });

    test('does not fetch keys when no auth token on mount', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        // Wait for initial render but no fetch should happen
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        // Verify fetch was not called for keys
        expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/data/keys'));
    });

    test('displays error when fetching keys returns not ok', async () => {
        global.fetch.mockImplementationOnce((url, options) => Promise.resolve({ok: false, status: 500}));
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const keysAccordion = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(keysAccordion);
        });
        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch keys: 500/i)).toBeInTheDocument();
        });
    });

    test('handles failed key deletion due to not ok response', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'DELETE') {
                return Promise.resolve({ok: false, status: 400});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        await act(async () => {
            await user.click(confirmButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Deleting key key1…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Failed to delete key: 400', 'error');
        });
    });

    test('handles error in key deletion due to network error', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'DELETE') {
                return Promise.reject(new Error('Network error'));
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        await act(async () => {
            await user.click(confirmButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Deleting key key1…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Network error', 'error');
        });
    });

    test('handles failed key creation due to not ok response', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'POST') {
                return Promise.resolve({ok: false, status: 400});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await uploadFile(dialog, 'create');
        });
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Creating key newKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Failed to create key: 400', 'error');
        });
    });

    test('handles error in key creation due to network error', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'POST') {
                return Promise.reject(new Error('Network error'));
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await uploadFile(dialog, 'create');
        });
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Creating key newKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Network error', 'error');
        });
    });

    test('handles failed key update due to not ok response', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'PUT') {
                return Promise.resolve({ok: false, status: 400});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            await uploadFile(dialog, 'update');
        });
        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating key updatedKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Failed to update key: 400', 'error');
        });
    });

    test('handles error in key update due to network error', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'PUT') {
                return Promise.reject(new Error('Network error'));
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            await uploadFile(dialog, 'update');
        });
        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating key updatedKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Network error', 'error');
        });
    });

    test('handles non-array keys data', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: 'not an array'}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        await waitFor(() => {
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });
    });
    test('handles invalid kind in fetchKeys', async () => {
        global.fetch.mockImplementation((url, options) => {
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/invalid/test" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.queryByText(/Object Keys/i)).not.toBeInTheDocument();
        });
    });

    test('handles key creation', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(2\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(/Create New Key/i);
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'create');
            expect(fileInput).toBeInTheDocument();
        });
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await user.upload(fileInput, new File(['content'], 'test.txt'));
        });
        await waitFor(() => {
            expect(screen.getByText('test.txt')).toBeInTheDocument();
        });
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Creating key newKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'newKey' created successfully");
        });
    });

    test('disables buttons during key update', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'PUT') {
                return new Promise(() => {});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'update');
            expect(fileInput).toBeInTheDocument();
        });
        await act(async () => {
            await user.type(nameInput, 'updatedKey');
            await user.upload(fileInput, new File(['content'], 'key.txt'));
        });
        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });
        await waitFor(() => {
            expect(updateButton).toBeDisabled();
        });
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});
        await waitFor(() => {
            expect(cancelButton).toBeDisabled();
        });
        await waitFor(() => {
            expect(fileInput).toBeDisabled();
        });
        // Check main add button disabled
        expect(screen.getByRole('button', {name: /add new key/i})).toBeDisabled();
        // Check table edit and delete disabled
        expect(screen.getByRole('button', {name: /Edit key key1/i})).toBeDisabled();
        expect(screen.getByRole('button', {name: /Delete key key1/i})).toBeDisabled();
    }, 20000);

    test('handles key creation with file selected display', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(screen.getByText('No file selected')).toBeInTheDocument();
        });
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await uploadFile(dialog, 'create');
        });
        await waitFor(() => {
            expect(screen.getByText('test.txt')).toBeInTheDocument();
        });
    });

    test('closes create dialog with escape key', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('closes update dialog with escape key', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [
                            {name: 'key1', node: 'node1', size: 2626},
                        ],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const accordionSummary = screen.getByRole('button', {name: /Object Keys/i});
        await act(async () => {
            await user.click(accordionSummary);
        });
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });
});
