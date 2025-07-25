import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeysSection from '../KeysSection';
import {URL_OBJECT} from '../../config/apiPath.js';

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
jest.mock('@mui/icons-material/UploadFile', () => () => <span data-testid="UploadFileIcon"/>);
jest.mock('@mui/icons-material/Edit', () => () => <span data-testid="EditIcon"/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn((key) => 'mock-token'),
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
        jest.clearAllMocks();
    });

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
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        const accordionSummary = screen.getByTestId('accordion-summary');
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

        let keysAccordionSummary;
        await waitFor(() => {
            keysAccordionSummary = screen.getByText(/Object Keys \(2\)/i);
            expect(keysAccordionSummary).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(keysAccordionSummary);
        });

        const keysAccordionDetails = keysAccordionSummary
            .closest('[data-testid="accordion"]')
            .querySelector('[data-testid="accordion-details"]');

        await waitFor(() => {
            expect(within(keysAccordionDetails).getByText('key1')).toBeInTheDocument();
            expect(within(keysAccordionDetails).getByText('key2')).toBeInTheDocument();
            expect(within(keysAccordionDetails).getByText('2626 bytes')).toBeInTheDocument();
            expect(within(keysAccordionDetails).getByText('6946 bytes')).toBeInTheDocument();
            const node1Elements = within(keysAccordionDetails).getAllByText('node1');
            expect(node1Elements).toHaveLength(2);
            node1Elements.forEach((element) => {
                expect(element).toBeInTheDocument();
                expect(element.tagName.toLowerCase()).toBe('td');
            });
        }, {timeout: 5000});
    });

    test('expands keys accordion', async () => {
        render(
            <KeysSection decodedObjectName="root/cfg/cfg1" openSnackbar={openSnackbar}/>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(2\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(2\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
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
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(0\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
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
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(0\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });

    test('disables buttons during key creation', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/data/key?name=')) {
                return new Promise(() => {
                }); // Never resolves
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

        const keysHeader = await screen.findByText(/Object Keys \(2\)/i, {}, {timeout: 10000});
        const accordionSummary = keysHeader.closest('[data-testid="accordion-summary"]') || keysHeader;
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

        const dialog = await waitFor(() => {
            let dialogElement = screen.queryByRole('dialog');
            if (dialogElement) return dialogElement;
            dialogElement = screen.getByText(/create new key|add key|new key/i)?.closest('div');
            if (!dialogElement) throw new Error('Dialog not found');
            return dialogElement;
        }, {timeout: 10000});

        await waitFor(() => {
            expect(dialog).toHaveTextContent(/create new key|add key|new key/i);
        });

        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        const fileInput = document.querySelector('#create-key-file-upload');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await user.upload(fileInput, new File(['content'], 'key.txt'));
        });

        const createButton = within(dialog).getByRole('button', {name: /create|add|save/i});
        await act(async () => {
            await user.click(createButton);
        });

        await waitFor(() => {
            expect(createButton).toBeDisabled();
            const cancelButton = within(dialog).getByRole('button', {name: /cancel|close/i});
            expect(cancelButton).toBeDisabled();
            expect(fileInput).toBeDisabled();
        }, {timeout: 5000});
    }, 20000);

    // New tests to improve coverage
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

        const keysHeader = await screen.findByText(/Object Keys \(2\)/i);
        await act(async () => {
            await user.click(keysHeader.closest('[data-testid="accordion-summary"]'));
        });

        const deleteButton = await screen.findAllByLabelText(/Delete key/i);
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await waitFor(() => screen.getByRole('dialog'));
        expect(dialog).toHaveTextContent(/Confirm Key Deletion/i);
        expect(dialog).toHaveTextContent(/key1/);

        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(openSnackbar).toHaveBeenCalledWith('Deleting key key1…', 'info');
            expect(openSnackbar).toHaveBeenCalledWith("Key 'key1' deleted successfully");
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

        const keysHeader = await screen.findByText(/Object Keys \(1\)/i);
        await act(async () => {
            await user.click(keysHeader.closest('[data-testid="accordion-summary"]'));
        });

        const deleteButton = await screen.findAllByLabelText(/Delete key/i);
        await act(async () => {
            await user.click(deleteButton[0]);
        });

        const dialog = await waitFor(() => screen.getByRole('dialog'));
        const confirmButton = within(dialog).getByRole('button', {name: /Delete/i});
        const cancelButton = within(dialog).getByRole('button', {name: /Cancel/i});

        await act(async () => {
            await user.click(confirmButton);
        });

        await waitFor(() => {
            expect(confirmButton).toBeDisabled();
            expect(cancelButton).toBeDisabled();
        });
    });
});
