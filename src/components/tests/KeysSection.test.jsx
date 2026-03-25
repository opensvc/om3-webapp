import React from 'react';
import {render, screen, waitFor, act, within, fireEvent} from '@testing-library/react';
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
    const mockReact = require('react');
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
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
        Dialog: ({children, open, maxWidth, fullWidth, fullScreen, onClose, ...props}) =>
            open ? <div role="dialog" data-fullscreen={fullScreen ? 'true' : 'false'} onKeyDown={(e) => {
                if (e.key === 'Escape') onClose();
            }} {...props}>{children}</div> : null,
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
            <table aria-label={ariaLabel} {...props}>{children})</table>
        ),
        TableHead: ({children, ...props}) => <thead {...props}>{children}</thead>,
        TableBody: ({children, ...props}) => <tbody {...props}>{children}</tbody>,
        TableRow: ({children, ...props}) => <tr {...props}>{children}</tr>,
        TableCell: ({children, component, scope, sx, ...props}) => (
            <td {...props}>{children}</td>
        ),
        Paper: ({children, sx, ...props}) => <div {...props}>{children}</div>,
        FormControl: ({children, ...props}) => <div {...props}>{children}</div>,
        FormLabel: ({children, ...props}) => <label {...props}>{children}</label>,
        RadioGroup: ({children, value, onChange, ...props}) => (
            <div role="radiogroup" data-value={value} {...props}>
                {mockReact.Children.map(children, child =>
                    mockReact.cloneElement(child, {onChange})
                )}
            </div>
        ),
        FormControlLabel: ({value, control, label, disabled, onChange, ...props}) => (
            <label {...props}>
                <input
                    type="radio"
                    value={value}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e)}
                    data-label={label}
                />
                {label}
            </label>
        ),
        Radio: () => null,
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/UploadFile', () => () => <span/>);
jest.mock('@mui/icons-material/Edit', () => () => <span/>);
jest.mock('@mui/icons-material/Delete', () => () => <span/>);
jest.mock('@mui/icons-material/Add', () => () => <span/>);
jest.mock('@mui/icons-material/Fullscreen', () => () => <span data-testid="fullscreen-icon"/>);
jest.mock('@mui/icons-material/FullscreenExit', () => () => <span data-testid="fullscreen-exit-icon"/>);
jest.mock('@mui/icons-material/Visibility', () => () => <span/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

const encodeText = (text) => new TextEncoder().encode(text);

const makeMockBlob = (uint8Array) => {
    const ab = uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength,
    );
    return {
        arrayBuffer: () => Promise.resolve(ab),
        size: uint8Array.byteLength,
        type: 'application/octet-stream',
    };
};

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
                    blob: () => Promise.resolve(makeMockBlob(encodeText('hello world'))),
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
        let fileInput = within(dialog).queryByTestId(inputId);
        if (fileInput) return fileInput;
        const allInputs = within(dialog).queryAllByRole('textbox');
        fileInput = allInputs.find(input => input.type === 'file' || input.id === inputId);
        if (fileInput) return fileInput;
        const fileInputs = within(dialog).queryAllByDisplayValue('');
        fileInput = fileInputs.find(input => input.type === 'file');
        if (fileInput) return fileInput;
        return null;
    };

    // Helper to select input mode
    const selectInputMode = async (dialog, mode) => {
        const radioGroup = within(dialog).getByRole('radiogroup');
        const radioButton = within(radioGroup).getByDisplayValue(mode);
        await act(async () => {
            await user.click(radioButton);
        });
    };

    // Helper to upload file
    const uploadFile = async (dialog, type = 'create') => {
        if (type === 'create') {
            await selectInputMode(dialog, 'file');
        }

        const fileInput = findFileInput(dialog, type);
        if (fileInput) {
            const file = new File(['test content'], 'test.txt', {type: 'text/plain'});
            await user.upload(fileInput, file);
        }
        return fileInput;
    };

    // Helper to get fullscreen button (icon inside Tooltip)
    const getFullscreenButton = (dialog) => {
        const icon = within(dialog).getByTestId('fullscreen-icon');
        return icon.closest('button');
    };

    const getExitFullscreenButton = (dialog) => {
        const icon = within(dialog).getByTestId('fullscreen-exit-icon');
        return icon.closest('button');
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

        await waitFor(() => {
            expect(screen.getByText('key1')).toBeInTheDocument();
        });

        expect(screen.getByText('key2')).toBeInTheDocument();
        expect(screen.getByText('2626 bytes')).toBeInTheDocument();
        expect(screen.getByText('6946 bytes')).toBeInTheDocument();

        const node1Elements = screen.getAllByText('node1');
        expect(node1Elements).toHaveLength(2);
        node1Elements.forEach((element) => {
            expect(element).toBeInTheDocument();
            expect(element.tagName.toLowerCase()).toBe('td');
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

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');

        await waitFor(() => {
            expect(dialog).toHaveTextContent(/Create New Key/i);
        });

        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        await selectInputMode(dialog, 'file');

        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'create');
            expect(fileInput).toBeTruthy();
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

        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(/Update Key/i);

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
            expect(openSnackbar).toHaveBeenCalledWith("Key 'updatedKey' updated successfully");
        });
    });

    test('disables buttons during key deletion', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/key') && url.includes('DELETE')) {
                return new Promise(() => {
                });
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
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(1\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});

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
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');

        await selectInputMode(dialog, 'file');

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        expect(createButton).toBeDisabled();
        await act(async () => {
            await user.click(createButton);
        });
        expect(openSnackbar).not.toHaveBeenCalled();
    });

    test('prevents key creation with name but without file', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');

        await selectInputMode(dialog, 'file');

        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'newKey');
        });
        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        expect(createButton).toBeDisabled();
        await act(async () => {
            await user.click(createButton);
        });
        expect(openSnackbar).not.toHaveBeenCalled();
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
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    blob: () => Promise.resolve(makeMockBlob(encodeText('dummy content'))),
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
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.clear(nameInput);
        });
        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        expect(updateButton).toBeDisabled();
        await act(async () => {
            await user.click(updateButton);
        });
        expect(openSnackbar).not.toHaveBeenCalled();
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
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
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

    test('does not fetch keys when no auth token on mount', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );
        await waitFor(() => {
            expect(screen.getByText((content) => /Object Keys \(0\)/i.test(content))).toBeInTheDocument();
        }, {timeout: 15000});
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
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent(/Create New Key/i);
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        await selectInputMode(dialog, 'file');

        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'create');
            expect(fileInput).toBeTruthy();
        });
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await user.upload(fileInput, new File(['content'], 'test.txt'));
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
                return new Promise(() => {
                });
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
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'update');
            expect(fileInput).toBeTruthy();
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
        expect(screen.getByRole('button', {name: /add new key/i})).toBeDisabled();
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
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');

        await selectInputMode(dialog, 'file');

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
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });
        const dialog = await screen.findByRole('dialog');
        fireEvent.keyDown(dialog, {key: 'Escape', code: 'Escape'});
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
        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });
        const dialog = await screen.findByRole('dialog');
        fireEvent.keyDown(dialog, {key: 'Escape', code: 'Escape'});
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('create dialog resets all fields after successful key creation', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options && options.method === 'POST') {
                return Promise.resolve({ok: true, json: () => Promise.resolve({})});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({ok: true, json: () => Promise.resolve({items: []})});
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        await act(async () => {
            await user.type(nameInput, 'tempKey');
        });

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // Re-open the dialog and verify the name is cleared
        await act(async () => {
            await user.click(addButton);
        });
        const newDialog = await screen.findByRole('dialog');
        const resetNameInput = within(newDialog).getByPlaceholderText('Key Name');
        expect(resetNameInput.value).toBe('');
    });

    test('handles key content with control characters as binary hex view', async () => {
        // BEL (0x07) is a control char that causes binary detection
        const binaryData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x07, 0x6f]); // "Hell\x07o"
        const mockBlob = makeMockBlob(binaryData);

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'ctrlkey', node: 'node1', size: binaryData.length}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        const viewButton = await screen.findByRole('button', {name: /View key ctrlkey/i});
        await act(async () => {
            await user.click(viewButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        }, {timeout: 10000});

        const dialog = screen.getByRole('dialog');

        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        }, {timeout: 10000});

        await waitFor(() => {
            expect(within(dialog).getByText(/Binary \(Hex View\)/i)).toBeInTheDocument();
        });
    });

    test('keys table displays all expected column headers', async () => {
        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(2\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('Size')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    test('create key with text mode does not require file validation', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options && options.method === 'POST') {
                return Promise.resolve({ok: true, json: () => Promise.resolve({})});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({ok: true, json: () => Promise.resolve({items: []})});
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        await selectInputMode(dialog, 'text');

        await act(async () => {
            await user.type(nameInput, 'myTextKey');
        });

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Creating key myTextKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'myTextKey' created successfully");
        });
    });

    test('closes delete dialog with escape key', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 2626}],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const deleteButton = await screen.findAllByRole('button', {name: /Delete key key1/i});
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        fireEvent.keyDown(dialog, {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('closes view dialog with escape key', async () => {
        const textContent = 'sample text';
        const mockBlob = makeMockBlob(encodeText(textContent));

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: textContent.length}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key key1/i});
        await act(async () => {
            await user.click(viewButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Wait for loading to finish
        await waitFor(() => {
            expect(within(screen.getByRole('dialog')).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        fireEvent.keyDown(dialog, {key: 'Escape', code: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('handles key update with empty text content', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'PUT') {
                return Promise.resolve({ok: true, json: () => Promise.resolve({})});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findAllByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton[0]);
        });

        const dialog = await screen.findByRole('dialog');
        await selectInputMode(dialog, 'text');

        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Updating key key1…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'key1' updated successfully");
        });
    });

    test('creates key with empty content mode', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options.method === 'POST') {
                return Promise.resolve({ok: true});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        });

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        await act(async () => {
            await user.type(nameInput, 'emptyKey');
        });

        await selectInputMode(dialog, 'empty');

        const createButton = within(dialog).getByRole('button', {name: /Create/i});
        expect(createButton).not.toBeDisabled();

        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Creating key emptyKey…', 'info');
        });
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'emptyKey' created successfully");
        });
    });

    test('shows snackbar when opening update dialog for binary key', async () => {
        const binaryData = new Uint8Array([0x00, 0x01, 0x02]);
        const mockBlob = makeMockBlob(binaryData);

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'binaryKey', node: 'node1', size: 3}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key binaryKey/i});
        await act(async () => {
            await user.click(editButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith(
                "Key is binary – please use file upload to update.",
                "info"
            );
        });

        const dialog = await screen.findByRole('dialog');
        const radioGroup = within(dialog).getByRole('radiogroup');
        expect(radioGroup).toHaveAttribute('data-value', 'file');
    });

    test('handles error when fetching key content for update', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: false, status: 500});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        expect(openSnackbar).toHaveBeenCalledWith('Failed to fetch key content: 500', 'error');

        const fileRadio = within(dialog).getByDisplayValue('file');
        expect(fileRadio).toBeInTheDocument();
    });

    test('closes view dialog with Close button', async () => {
        const textContent = 'sample text';
        const mockBlob = makeMockBlob(encodeText(textContent));

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: textContent.length}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key key1/i});
        await act(async () => {
            await user.click(viewButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(screen.getByRole('dialog')).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        const closeButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Close/i});
        await act(async () => {
            await user.click(closeButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('handles view key with missing auth token', async () => {
        mockLocalStorage.getItem.mockReturnValue(null);

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        });

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            return Promise.resolve({ok: true});
        });

        mockLocalStorage.getItem.mockReturnValue('mock-token');
        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key key1/i});

        mockLocalStorage.getItem.mockReturnValue(null);

        await act(async () => {
            await user.click(viewButton);
        });

        expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('handleViewKey displays text content correctly', async () => {
        const textContent = 'Hello, World!';
        const mockBlob = makeMockBlob(encodeText(textContent));

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'textkey', node: 'node1', size: textContent.length}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key textkey/i});
        await act(async () => {
            await user.click(viewButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(screen.getByRole('dialog')).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        // Check for the type indicator – text is present but may be split across elements
        expect(within(dialog).getByText(/Type:\s*Text/i)).toBeInTheDocument();
        // Also verify the actual content is displayed
        expect(within(dialog).getByDisplayValue(textContent)).toBeInTheDocument();
    });

    test('create dialog enters and exits fullscreen text mode', async () => {
        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            await user.click(addButton);
        });

        const dialog = await screen.findByRole('dialog');

        // Switch to text mode first
        await selectInputMode(dialog, 'text');

        // Find the fullscreen button (via its child icon)
        const fullscreenBtn = getFullscreenButton(dialog);
        expect(fullscreenBtn).toBeInTheDocument();

        await act(async () => {
            await user.click(fullscreenBtn);
        });

        // Dialog should now be fullscreen
        await waitFor(() => {
            const updatedDialog = screen.getByRole('dialog');
            expect(updatedDialog).toHaveAttribute('data-fullscreen', 'true');
        });

        // Exit fullscreen via the exit button
        const exitBtn = getExitFullscreenButton(screen.getByRole('dialog'));
        expect(exitBtn).toBeInTheDocument();
        await act(async () => {
            await user.click(exitBtn);
        });

        await waitFor(() => {
            const updatedDialog = screen.getByRole('dialog');
            expect(updatedDialog).toHaveAttribute('data-fullscreen', 'false');
        });
    });

    test('update dialog enters and exits fullscreen text mode', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    blob: () => Promise.resolve(makeMockBlob(encodeText('some text content'))),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');

        // Wait for content to load (text mode should be auto-selected for text content)
        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Should be in text mode already since content is text
        await waitFor(() => {
            const radioGroup = within(dialog).getByRole('radiogroup');
            expect(radioGroup).toHaveAttribute('data-value', 'text');
        });

        // Find the fullscreen button (via its child icon)
        const fullscreenBtn = getFullscreenButton(dialog);
        expect(fullscreenBtn).toBeInTheDocument();

        await act(async () => {
            await user.click(fullscreenBtn);
        });

        // Dialog should now be fullscreen
        await waitFor(() => {
            const updatedDialog = screen.getByRole('dialog');
            expect(updatedDialog).toHaveAttribute('data-fullscreen', 'true');
        });

        // Exit fullscreen
        const exitBtn = getExitFullscreenButton(screen.getByRole('dialog'));
        expect(exitBtn).toBeInTheDocument();
        await act(async () => {
            await user.click(exitBtn);
        });

        await waitFor(() => {
            const updatedDialog = screen.getByRole('dialog');
            expect(updatedDialog).toHaveAttribute('data-fullscreen', 'false');
        });
    });

    test('create dialog fullscreen mode hides name/radio fields and shows only textarea', async () => {
        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        await act(async () => {
            await user.click(screen.getByRole('button', {name: /add new key/i}));
        });

        const dialog = await screen.findByRole('dialog');
        await selectInputMode(dialog, 'text');

        const fullscreenBtn = getFullscreenButton(dialog);
        expect(fullscreenBtn).toBeInTheDocument();
        await act(async () => {
            await user.click(fullscreenBtn);
        });

        await waitFor(() => {
            // In fullscreen, Key Name input should not be visible
            expect(within(screen.getByRole('dialog')).queryByPlaceholderText('Key Name')).not.toBeInTheDocument();
            // Radio group should also be hidden
            expect(within(screen.getByRole('dialog')).queryByRole('radiogroup')).not.toBeInTheDocument();
            // Textarea should be present
            const textarea = within(screen.getByRole('dialog')).getByPlaceholderText(/enter the text content/i);
            expect(textarea).toBeInTheDocument();
        });
    });

    test('update dialog cancel resets fullscreen state', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    blob: () => Promise.resolve(makeMockBlob(encodeText('text content'))),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Enter fullscreen
        const fullscreenBtn = getFullscreenButton(dialog);
        expect(fullscreenBtn).toBeInTheDocument();
        await act(async () => {
            await user.click(fullscreenBtn);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveAttribute('data-fullscreen', 'true');
        });

        // Click cancel — should close dialog (and reset fullscreen state)
        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // Re-open — fullscreen should be reset
        await act(async () => {
            await user.click(editButton);
        });

        const newDialog = await screen.findByRole('dialog');
        expect(newDialog).toHaveAttribute('data-fullscreen', 'false');
    });

    test('create dialog cancel resets fullscreen state', async () => {
        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        await act(async () => {
            await user.click(screen.getByRole('button', {name: /add new key/i}));
        });

        const dialog = await screen.findByRole('dialog');
        await selectInputMode(dialog, 'text');

        const fullscreenBtn = getFullscreenButton(dialog);
        expect(fullscreenBtn).toBeInTheDocument();
        await act(async () => {
            await user.click(fullscreenBtn);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveAttribute('data-fullscreen', 'true');
        });

        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        // Re-open — should not be fullscreen
        await act(async () => {
            await user.click(screen.getByRole('button', {name: /add new key/i}));
        });

        const newDialog = await screen.findByRole('dialog');
        expect(newDialog).toHaveAttribute('data-fullscreen', 'false');
    });

    test('fetchKeyContent handles no auth token', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        // Remove auth token before clicking edit
        mockLocalStorage.getItem.mockReturnValue(null);

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Auth token not found.', 'error');
        });
    });

    test('fetchKeyContent handles network error during update prefetch', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.reject(new Error('Connection refused'));
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Error: Connection refused', 'error');
        });
    });

    test('view key displays empty blob as binary', async () => {
        // Empty Uint8Array: isText will be false because textContent.length === 0
        const emptyData = new Uint8Array([]);
        const mockBlob = makeMockBlob(emptyData);

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'emptykey', node: 'node1', size: 0}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => Promise.resolve(mockBlob)});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key emptykey/i});
        await act(async () => {
            await user.click(viewButton);
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(within(screen.getByRole('dialog')).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Empty content → falls into binary branch (content.length === 0, isText condition fails)
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/Binary \(Hex View\)/i)).toBeInTheDocument();
    });

    test('update key via file upload branch sends file body', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key') && options && options.method === 'PUT') {
                // Verify the body is a File (file upload branch)
                expect(options.body).toBeInstanceOf(File);
                return Promise.resolve({ok: true});
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    blob: () => Promise.resolve(makeMockBlob(encodeText('text content'))),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(within(dialog).queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Switch to file mode
        await selectInputMode(dialog, 'file');

        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'update');
            expect(fileInput).toBeTruthy();
        });

        await act(async () => {
            await user.upload(fileInput, new File(['file content'], 'upload.txt'));
        });

        const updateButton = within(dialog).getByRole('button', {name: /Update/i});
        await act(async () => {
            await user.click(updateButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'key1' updated successfully");
        });
    });

    test('create key with text content sends Blob body', async () => {
        let capturedBody;
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options && options.method === 'POST') {
                capturedBody = options.body;
                return Promise.resolve({ok: true});
            }
            if (url.includes('/data/keys')) {
                return Promise.resolve({ok: true, json: () => Promise.resolve({items: []})});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        }, {timeout: 15000});

        await act(async () => {
            await user.click(screen.getByRole('button', {name: /add new key/i}));
        });

        const dialog = await screen.findByRole('dialog');
        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        await selectInputMode(dialog, 'text');

        await act(async () => {
            await user.type(nameInput, 'blobKey');
        });

        // Type some text content
        const textArea = within(dialog).getByPlaceholderText(/enter the text content/i);
        await act(async () => {
            await user.type(textArea, 'some text data');
        });

        await act(async () => {
            await user.click(within(dialog).getByRole('button', {name: /Create/i}));
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'blobKey' created successfully");
        });

        // Body should be a Blob for text mode
        expect(capturedBody).toBeInstanceOf(Blob);
    });

    test('displays loading spinner in update dialog while content is loading', async () => {
        let resolveBlob;
        const blobPromise = new Promise((res) => {
            resolveBlob = res;
        });

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'key1', node: 'node1', size: 100}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: true, blob: () => blobPromise});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const editButton = await screen.findByRole('button', {name: /Edit key key1/i});
        await act(async () => {
            await user.click(editButton);
        });

        const dialog = await screen.findByRole('dialog');
        // Should show spinner while content loads
        expect(within(dialog).getByRole('progressbar')).toBeInTheDocument();

        // Resolve to clean up
        await act(async () => {
            resolveBlob(makeMockBlob(encodeText('hello')));
        });
    });


    test('add new key button is rendered and accessible', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({ok: true, json: () => Promise.resolve({items: []})});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(0\)/i.test(c))).toBeInTheDocument();
        });

        const addButton = screen.getByRole('button', {name: /add new key/i});
        expect(addButton).toBeInTheDocument();
        expect(addButton).not.toBeDisabled();

        // Verify the tooltip container wraps it
        const tooltipContainer = addButton.closest('[data-tooltip]');
        expect(tooltipContainer).toHaveAttribute('data-tooltip', 'Add new key');
    });

    test('view key failure shows error snackbar and does not display dialog content', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        items: [{name: 'failkey', node: 'node1', size: 50}],
                    }),
                });
            }
            if (url.includes('/data/key')) {
                return Promise.resolve({ok: false, status: 500});
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        const viewButton = await screen.findByRole('button', {name: /View key failkey/i});
        await act(async () => {
            await user.click(viewButton);
        });

        // Dialog should be closed after failure
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Failed to fetch key content: 500', 'error');
        });
    });

    test('fetchKeys called internally with no token sets auth error', async () => {
        // Render with a valid token initially
        mockLocalStorage.getItem.mockReturnValue('mock-token');

        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: [{name: 'k1', node: 'n1', size: 5}]}),
                });
            }
            return Promise.resolve({ok: true});
        });

        render(<KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>);

        await waitFor(() => {
            expect(screen.getByText((c) => /Object Keys \(1\)/i.test(c))).toBeInTheDocument();
        });

        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/data/key') && options && options.method === 'DELETE') {
                // Succeed, then remove token so subsequent fetchKeys fails
                mockLocalStorage.getItem.mockReturnValue(null);
                return Promise.resolve({ok: true});
            }
            if (url.includes('/data/keys')) {
                // This should not be reached because fetchKeys will see no token
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({items: []}),
                });
            }
            return Promise.resolve({ok: true});
        });

        const deleteButton = await screen.findByRole('button', {name: /Delete key k1/i});
        await act(async () => {
            await user.click(deleteButton);
        });

        const dialog = await screen.findByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});

        await act(async () => {
            await user.click(confirmButton);
        });

        // The delete succeeds, then fetchKeys is called with no token
        // The no-token branch sets keysError
        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith("Key 'k1' deleted successfully");
        });

        // With no token, fetchKeys returns early setting the error
        await waitFor(() => {
            // keysError should be set — it appears as an Alert on screen
            const alerts = screen.queryAllByRole('alert');
            const hasAuthError = alerts.some(a => a.textContent.includes('Auth token not found'));
            expect(hasAuthError).toBe(true);
        });
    });
});