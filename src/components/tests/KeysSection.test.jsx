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

    // Helper function to find file inputs without direct DOM access
    const findFileInput = (dialog, type = 'create') => {
        const inputId = type === 'create' ? 'create-key-file-upload' : 'update-key-file-upload';

        // Strategy 1: Use screen.getByTestId if available
        try {
            return screen.getByTestId(inputId);
        } catch {
            // Continue to other strategies
        }

        // Strategy 2: Look within dialog using Testing Library methods
        const allInputs = within(dialog).queryAllByRole('textbox');
        let fileInput = allInputs.find(input => input.type === 'file' || input.id === inputId);

        // Strategy 3: Look for file inputs by their accept attribute
        if (!fileInput) {
            const fileInputs = within(dialog).queryAllByDisplayValue('');
            fileInput = fileInputs.find(input => input.type === 'file');
        }

        // Strategy 4: Look for upload buttons and find associated input
        if (!fileInput) {
            const uploadButtons = within(dialog).queryAllByRole('button', {name: /upload file/i});
            if (uploadButtons.length > 0) {
                const labelButton = uploadButtons[0];
                if (labelButton.htmlFor) {
                    const label = screen.queryByLabelText(/upload file/i);
                    if (label && label.htmlFor) {
                        fileInput = screen.queryByLabelText(/upload file/i);
                    }
                }
            }
        }

        return fileInput || null;
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

        const nameInput = within(dialog).getByPlaceholderText('Key Name');

        // Find file input using helper
        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'update');
            expect(fileInput).toBeInTheDocument();
        });

        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            if (fileInput) {
                await user.upload(fileInput, new File(['content'], 'updatedKey.txt'));
            }
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

        // Find file input using helper
        let fileInput;
        await waitFor(() => {
            fileInput = findFileInput(dialog, 'update');
            expect(fileInput).toBeInTheDocument();
        });

        await act(async () => {
            await user.clear(nameInput);
            await user.type(nameInput, 'updatedKey');
            if (fileInput) {
                await user.upload(fileInput, new File(['content'], 'updatedKey.txt'));
            }
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
});
