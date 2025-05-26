import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import useEventStore from '../../hooks/useEventStore.js';
import useFetchDaemonStatus from '../../hooks/useFetchDaemonStatus.jsx';
import {closeEventSource} from '../../eventSourceManager.jsx';

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
jest.mock('../../hooks/useFetchDaemonStatus.jsx');
jest.mock('../../eventSourceManager.jsx', () => ({
    closeEventSource: jest.fn(),
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
        AccordionSummary: ({children, id, onChange, ...props}) => (
            <div
                role="button"
                data-testid="accordion-summary"
                onClick={() => onChange?.({}, !props.expanded)}
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
        Menu: ({children, open, anchorEl, onClose, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>
                {children}
            </div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children, ...props}) => <span {...props}>{children}</span>,
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
        Checkbox: ({checked, onChange, ...props}) => (
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
        ),
        IconButton: ({children, onClick, ...props}) => (
            <button onClick={onClick} {...props}>
                {children}
            </button>
        ),
        TextField: ({label, value, onChange, disabled, ...props}) => (
            <input
                type="text"
                placeholder={label}
                value={value}
                onChange={onChange}
                disabled={disabled}
                {...props}
            />
        ),
        Input: ({type, onChange, disabled, ...props}) => (
            <input type={type} onChange={onChange} disabled={disabled} {...props} />
        ),
        CircularProgress: () => <div role="progressbar">Loading...</div>,
        Box: ({children, sx, ...props}) => (
            <div style={{...sx, minWidth: sx?.minWidth || 'auto'}} {...props}>
                {children}
            </div>
        ),
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
        FiberManualRecordIcon: ({sx, ...props}) => (
            <svg
                data-testid="FiberManualRecordIcon"
                style={{color: sx?.color, fontSize: sx?.fontSize}}
                {...props}
            />
        ),
    };
});

describe('ObjectDetail Component', () => {
    const mockFetchNodes = jest.fn();
    const mockStartEventReception = jest.fn();

    beforeEach(() => {
        jest.setTimeout(20000);
        jest.clearAllMocks();

        // Mock localStorage
        Storage.prototype.getItem = jest.fn((key) => 'mock-token');
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();

        // Mock useParams
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        // Mock useFetchDaemonStatus
        useFetchDaemonStatus.mockReturnValue({
            fetchNodes: mockFetchNodes,
            startEventReception: mockStartEventReception,
        });

        // Mock useEventStore
        const mockState = {
            objectStatus: {
                'root/cfg/cfg1': {
                    avail: 'up',
                    frozen: 'frozen',
                },
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {
                    node1: {
                        avail: 'up',
                        frozen_at: '2023-01-01T12:00:00Z',
                        resources: {
                            res1: {
                                status: 'up',
                                label: 'Resource 1',
                                type: 'disk',
                                provisioned: {state: "true", mtime: '2023-01-01T12:00:00Z'},
                            },
                            res2: {
                                status: 'down',
                                label: 'Resource 2',
                                type: 'network',
                                provisioned: {state: "false", mtime: '2023-01-01T12:00:00Z'},
                            },
                        },
                    },
                    node2: {
                        avail: 'down',
                        frozen_at: null,
                        resources: {
                            res3: {
                                status: 'warn',
                                label: 'Resource 3',
                                type: 'compute',
                                provisioned: {state: "true", mtime: '2023-01-01T12:00:00Z'},
                            },
                        },
                    },
                },
            },
            instanceMonitor: {
                'node1:root/cfg/cfg1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                },
                'node2:root/cfg/cfg1': {
                    state: 'idle',
                    global_expect: 'none',
                },
            },
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock fetch with logging
        global.fetch = jest.fn((url, options) => {
            console.log(`Fetch called with URL: ${url}, Options:`, options);
            if (url.includes('/api/object/path/root/cfg/cfg1/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            items: [
                                {name: 'key1', node: 'node1', size: 2626},
                                {name: 'key2', node: 'node1', size: 6946},
                            ],
                        }),
                });
            }
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file') && options?.method === 'PUT') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file')) {
                return Promise.resolve({
                    ok: true,
                    text: () =>
                        Promise.resolve(`
[DEFAULT]
nodes = *
orchestrate = ha
id = 0bfea9c4-0114-4776-9169-d5e3455cee1f
long_line = this_is_a_very_long_unbroken_string_that_should_trigger_a_horizontal_scrollbar_abcdefghijklmnopqrstuvwxyz1234567890

[fs#1]
type = flag
            `),
                });
            }
            if (url.includes('/api/object/path/root/cfg/cfg1/data/key')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('displays configuration with horizontal scrolling', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for Configuration to be loaded
        await screen.findByText(/Configuration/i);

        // Find and click the accordion
        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        fireEvent.click(accordionSummary);

        // Verify basic content
        await screen.findByText(/nodes = \*/i);
        expect(screen.getByText(/orchestrate = ha/i)).toBeInTheDocument();
        expect(screen.getByText(/type = flag/i)).toBeInTheDocument();

        // Verify the presence of the scrollable container
        const accordionDetails = within(configAccordion).getByTestId('accordion-details');
        const scrollableBox = accordionDetails.querySelector('div[style*="overflow-x: auto"]') ||
            accordionDetails.querySelector('pre')?.parentElement;

        expect(scrollableBox).toBeInTheDocument();
        expect(scrollableBox).toHaveStyle({'overflow-x': 'auto'});

        // Verify the long line
        const preElement = within(scrollableBox).getByText(
            /long_line = this_is_a_very_long_unbroken_string/
        );
        expect(preElement).toBeInTheDocument();
    }, 15000);

    test('displays error when fetching configuration fails', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file')) {
                return Promise.reject(new Error('Failed to fetch configuration'));
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
        });

        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => {
            fireEvent.click(accordionSummary);
        });

        await waitFor(() => {
            const errorElement = screen.getByText((content) => /failed to fetch.*config/i.test(content));
            expect(errorElement).toBeInTheDocument();
            expect(errorElement.closest('[role="alert"]')).toHaveAttribute('data-severity', 'error');
        });
    }, 10000);

    test('displays no configuration message when no config data', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file')) {
                return Promise.resolve({ok: true, text: () => Promise.resolve('')});
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
        });

        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => {
            fireEvent.click(accordionSummary);
        });

        await waitFor(() => {
            const noConfigElement = screen.getByText((content) => /no.*configuration.*available/i.test(content));
            expect(noConfigElement).toBeInTheDocument();
        });
    }, 10000);

    test('displays loading indicator while fetching configuration', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file')) {
                return new Promise(() => {
                }); // Never resolves to simulate loading
            }
            return Promise.resolve({ok: true, json: () => Promise.resolve({})});
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
        });

        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => {
            fireEvent.click(accordionSummary);
        });

        await waitFor(() => {
            const progressBar = within(configAccordion).getByRole('progressbar');
            expect(progressBar).toBeInTheDocument();
        });
    }, 10000);

    test('opens update configuration dialog and updates configuration', async () => {
        // Setup fetch mock
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file') && options.method === 'PUT') {
                return Promise.resolve({ok: true, json: () => Promise.resolve({})});
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait and expand configuration
        await waitFor(() => expect(screen.getByText(/Configuration/i)).toBeInTheDocument());
        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => fireEvent.click(accordionSummary));

        // Find edit button
        const editButton = screen.getByRole('button', {name: /edit/i});
        await act(async () => fireEvent.click(editButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Update Configuration')).toBeInTheDocument());

        // Select file
        const fileInput = screen.getByRole('button', {name: /choose file/i});
        const testFile = new File(['test content'], 'config.ini', {type: 'text/plain'});

        const hiddenFileInput = document.querySelector('input[type="file"]');
        await act(async () => {
            fireEvent.change(hiddenFileInput, {target: {files: [testFile]}});
        });

        // Verify file selection
        await waitFor(() => expect(screen.getByText(/config.ini/)).toBeInTheDocument());

        // Click Update
        const updateButton = screen.getByRole('button', {name: /update/i});
        await act(async () => fireEvent.click(updateButton));

        // Verify API call and success message
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/config/file'),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        'Content-Type': 'application/octet-stream',
                    }),
                    body: testFile,
                })
            );
            expect(screen.getByText(/Configuration updated successfully/)).toBeInTheDocument();
        });
    }, 15000);

    test('displays error when configuration update fails', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file') && options.method === 'PUT') {
                return Promise.reject(new Error('Failed to update configuration'));
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait and expand configuration
        await waitFor(() => expect(screen.getByText(/Configuration/i)).toBeInTheDocument());
        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => fireEvent.click(accordionSummary));

        // Find edit button
        const editButton = screen.getByRole('button', {name: /edit/i});
        await act(async () => fireEvent.click(editButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Update Configuration')).toBeInTheDocument());

        // Select file
        const hiddenFileInput = document.querySelector('input[type="file"]');
        await act(async () => {
            fireEvent.change(hiddenFileInput, {target: {files: [new File(['new config'], 'config.ini')]}});
        });

        // Click Update
        const updateButton = screen.getByRole('button', {name: /update/i});
        await act(async () => fireEvent.click(updateButton));

        // Verify error message
        await waitFor(() => {
            expect(screen.getByText(/Error: Failed to update configuration/i)).toBeInTheDocument();
        });
    }, 10000);

    test('disables buttons during configuration update', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config/file') && options.method === 'PUT') {
                return new Promise(() => {
                }); // Never resolves
            }
            return Promise.resolve({
                ok: true,
                text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait and expand configuration
        await waitFor(() => expect(screen.getByText(/Configuration/i)).toBeInTheDocument());
        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => fireEvent.click(accordionSummary));

        // Find edit button
        const editButton = screen.getByRole('button', {name: /edit/i});
        await act(async () => fireEvent.click(editButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Update Configuration')).toBeInTheDocument());

        // Select file
        const hiddenFileInput = document.querySelector('input[type="file"]');
        await act(async () => {
            fireEvent.change(hiddenFileInput, {target: {files: [new File(['new config'], 'config.ini')]}});
        });

        // Click Update
        const updateButton = screen.getByRole('button', {name: /update/i});
        await act(async () => fireEvent.click(updateButton));

        // Verify buttons are disabled
        await waitFor(() => {
            expect(updateButton).toBeDisabled();
            const cancelButton = screen.getByRole('button', {name: /cancel/i});
            expect(cancelButton).toBeDisabled();

            const chooseFileButton = screen.getByRole('button', {name: /choose file/i});
            expect(chooseFileButton).toHaveAttribute('aria-disabled', 'true');
        });
    }, 10000);

    test('cancels update configuration dialog', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
        });

        const configAccordion = screen.getByText(/Configuration/i).closest('[data-testid="accordion"]');
        const accordionSummary = within(configAccordion).getByTestId('accordion-summary');
        await act(async () => {
            fireEvent.click(accordionSummary);
        });

        const editButton = screen.getByRole('button', {name: /edit configuration/i});
        await act(async () => {
            fireEvent.click(editButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Update Configuration')).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole('button', {name: /Cancel/i});
        await act(async () => {
            fireEvent.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByText('Update Configuration')).not.toBeInTheDocument();
        });

        // Verify no API call was made
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/api/object/path/root/cfg/cfg1/config/file'),
            expect.objectContaining({method: 'PUT'})
        );
    }, 10000);

    test('renders object name and no information message when no data', async () => {
        useEventStore.mockImplementation((selector) =>
            selector({objectStatus: {}, objectInstanceStatus: {}, instanceMonitor: {}})
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('root/cfg/cfg1')).toBeInTheDocument();
            expect(screen.getByText(/No information available for object/i)).toBeInTheDocument();
        });
    });

    test('renders global status, nodes, and resources', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('root/cfg/cfg1')).toBeInTheDocument();
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
            expect(screen.getByText('Node: node2')).toBeInTheDocument();
            expect(screen.getByText('Resources (2)')).toBeInTheDocument();
            expect(screen.getByText('Resources (1)')).toBeInTheDocument();
            expect(screen.getByText('running')).toBeInTheDocument();
            expect(screen.getByText('placed@node1')).toBeInTheDocument();
        });

        const node1AccordionToggle = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(node1AccordionToggle);
        });
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        });

        const node2AccordionToggle = screen.getByText('Resources (1)').closest('div');
        await act(async () => {
            fireEvent.click(node2AccordionToggle);
        });
        await waitFor(() => {
            expect(screen.getByText('res3')).toBeInTheDocument();
        });
    });

    test('calls fetchNodes and startEventReception on mount', () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(mockFetchNodes).toHaveBeenCalledWith('mock-token');
        expect(mockStartEventReception).toHaveBeenCalledWith('mock-token');
    });

    test('calls closeEventSource on unmount', async () => {
        const {unmount} = render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await act(async () => {
            unmount();
        });
        expect(closeEventSource).toHaveBeenCalled();
    });

    test('does not call fetchNodes or startEventReception without auth token', () => {
        Storage.prototype.getItem = jest.fn(() => null);
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(mockFetchNodes).not.toHaveBeenCalled();
        expect(mockStartEventReception).not.toHaveBeenCalled();
    });

    test('enables batch node actions button when nodes are selected', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            const nodeCheckbox = screen.getAllByRole('checkbox')[0];
            fireEvent.click(nodeCheckbox);
            const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
            expect(actionsButton).not.toBeDisabled();
        });
    });

    test('opens batch node actions menu and triggers freeze action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Find and click freeze option
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const freezeItem = menuItems.find((item) => item.textContent.includes('Freeze'));
            expect(freezeItem).toBeInTheDocument();
            fireEvent.click(freezeItem);
        });

        // Verify confirm dialog appears
        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Check the confirmation checkbox
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) => cb.closest('[role="dialog"]'));
        fireEvent.click(dialogCheckbox);

        // Click confirm button
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });

        // Verify snackbar
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/'freeze' succeeded on node 'node1'/i);
        });
    }, 10000);

    test('triggers individual node stop action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open node menu (IconButton with MoreVertIcon)
        const nodeSection = screen.getByText('Node: node1').closest('div').parentElement;
        const nodeMenuButton = within(nodeSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(nodeMenuButton);
        });

        // Click 'stop' menu item
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const stopItem = menuItems.find((item) => item.textContent.toLowerCase() === 'stop');
            expect(stopItem).toBeInTheDocument();
            fireEvent.click(stopItem);
        });

        // Verify dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Stop')).toBeInTheDocument();
        });

        // Check checkbox and confirm
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) => cb.closest('[role="dialog"]'));
        await act(async () => {
            fireEvent.click(dialogCheckbox);
        });
        const confirmButton = screen.getByRole('button', {name: /Stop/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('triggers batch resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion by clicking the summary
        const resourcesSection = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(resourcesSection);
        });

        // Select resource
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });
        const resourceSection = screen.getByText('res1').closest('div');
        const resourceCheckbox = within(resourceSection).getByRole('checkbox');
        await act(async () => {
            fireEvent.click(resourceCheckbox);
        });

        global.fetch.mockClear();

        const resourceMenuButton = within(resourcesSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );
        await act(async () => {
            fireEvent.click(resourceMenuButton);
        });

        // Select 'start' action
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const startItem = menuItems.find((item) => item.textContent === 'Start');
            expect(startItem).toBeInTheDocument();
            fireEvent.click(startItem);
        });

        // Confirm action
        await waitFor(() => {
            expect(screen.getByText('Confirm start')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/start'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion
        const resourcesSection = screen.getByText('Resources (2)').closest('div');
        await act(async () => {
            fireEvent.click(resourcesSection);
        });

        // Wait for resource
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
        });

        global.fetch.mockClear();

        const resourceSection = screen.getByText('res1').closest('div');
        const resourceMenuButton = within(resourceSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );

        // Log pour déboguer
        console.log('[Test] Resource menu button found:', resourceMenuButton ? 'Yes' : 'No');
        if (!resourceMenuButton) {
            console.log('[Test] Resource section DOM:', resourceSection.outerHTML);
            screen.debug();
        }
        expect(resourceMenuButton).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(resourceMenuButton);
        });

        // Attendre que le menu soit ouvert
        await waitFor(
            () => {
                const menu = screen.getByRole('menu');
                expect(menu).toBeInTheDocument();
                console.log('[Test] Menu DOM:', menu.outerHTML);

                const menuItems = screen.getAllByRole('menuitem');
                console.log(
                    '[Test] Menu items:',
                    menuItems.map((item) => item.textContent)
                );
                const restartItem = menuItems.find((item) => item.textContent.toLowerCase() === 'restart');
                expect(restartItem).toBeInTheDocument();
                fireEvent.click(restartItem);
            },
            {timeout: 10000}
        );

        // Confirm action
        await waitFor(() => {
            expect(screen.getByText('Confirm restart')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/restart?rid=res1'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 15000);

    test('triggers object action with unprovision dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('root/cfg/cfg1')).toBeInTheDocument();
        });

        global.fetch.mockClear();

        const headerSection = screen.getByText('root/cfg/cfg1').closest('div');
        const objectMenuButton = within(headerSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );

        // Log pour déboguer
        console.log('[Test] Object menu button found:', objectMenuButton ? 'Yes' : 'No');
        if (!objectMenuButton) {
            console.log('[Test] Header section DOM:', headerSection.outerHTML);
            screen.debug();
        }
        expect(objectMenuButton).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(objectMenuButton);
        });

        // Attendre que le menu soit ouvert
        await waitFor(
            () => {
                const menu = screen.getByRole('menu');
                expect(menu).toBeInTheDocument();
                console.log('[Test] Menu DOM:', menu.outerHTML);

                const menuItems = screen.getAllByRole('menuitem');
                console.log(
                    '[Test] Menu items:',
                    menuItems.map((item) => item.textContent)
                );
                const unprovisionItem = menuItems.find((item) => item.textContent.toLowerCase() === 'unprovision');
                expect(unprovisionItem).toBeInTheDocument();
                fireEvent.click(unprovisionItem);
            },
            {timeout: 10000}
        );

        // Fill dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Unprovision')).toBeInTheDocument();
        });
        const dialogCheckbox = screen.getAllByRole('checkbox').find((cb) => cb.closest('[role="dialog"]'));
        await act(async () => {
            fireEvent.click(dialogCheckbox);
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/action/unprovision'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('expands node and resource accordions', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Expand node resources
        const resourcesToggle = screen.getByText('Resources (2)');
        await act(async () => {
            fireEvent.click(resourcesToggle);
        });

        // Verify resources
        await waitFor(() => {
            const res1 = screen.queryByText('res1');
            if (!res1) {
                screen.debug();
            }
            expect(res1).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        });

        // Expand resource details
        const resourceSection = screen.getByText('res1').closest('div');
        await act(async () => {
            fireEvent.click(resourceSection);
        });

        // Verify resource details with flexible matcher
        await waitFor(() => {
            const resourceDetails = screen.getByText((content, element) => content.includes('Resource 1'));
            expect(resourceDetails).toBeInTheDocument();

            // Verify provisioned icon for res1 (state: "true")
            const res1Details = screen.getByText('Resource 1').closest('[data-testid="accordion-details"]');
            const res1Icon = within(res1Details).getByTestId('FiberManualRecordIcon');
            expect(res1Icon).toHaveStyle({color: '#4caf50'}); // green[500]
        });

        // Expand and verify res2
        const res2Section = screen.getByText('res2').closest('div');
        await act(async () => {
            fireEvent.click(res2Section);
        });

        await waitFor(() => {
            const res2Details = screen.getByText('Resource 2').closest('[data-testid="accordion-details"]');
            const res2Icon = within(res2Details).getByTestId('FiberManualRecordIcon');
            expect(res2Icon).toHaveStyle({color: '#f44336'}); // red[500]
        });
    }, 10000);

    test('displays provisioned state correctly for resources', async () => {
        // Add a resource with provisioned.state: "n/a" to test this case
        useEventStore.mockImplementation((selector) =>
            selector({
                objectStatus: {
                    'root/cfg/cfg1': {
                        avail: 'up',
                        frozen: 'frozen',
                    },
                },
                objectInstanceStatus: {
                    'root/cfg/cfg1': {
                        node1: {
                            avail: 'up',
                            frozen_at: '2023-01-01T12:00:00Z',
                            resources: {
                                res1: {
                                    status: 'up',
                                    label: 'Resource 1',
                                    type: 'disk',
                                    provisioned: {state: "true", mtime: '2023-01-01T12:00:00Z'},
                                },
                                res2: {
                                    status: 'down',
                                    label: 'Resource 2',
                                    type: 'network',
                                    provisioned: {state: "false", mtime: '2023-01-01T12:00:00Z'},
                                },
                                res3: {
                                    status: 'warn',
                                    label: 'Resource 3',
                                    type: 'compute',
                                    provisioned: {state: "n/a", mtime: '2023-01-01T12:00:00Z'},
                                },
                            },
                        },
                    },
                },
                instanceMonitor: {
                    'node1:root/cfg/cfg1': {
                        state: 'running',
                        global_expect: 'placed@node1',
                    },
                },
            })
        );

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for resources to be displayed
        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Open resources accordion
        const resourcesSection = screen.getByText('Resources (3)').closest('div');
        await act(async () => {
            fireEvent.click(resourcesSection);
        });

        // Verify resources are displayed
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
            expect(screen.getByText('res3')).toBeInTheDocument();
        });

        // Open details for each resource
        for (const resId of ['res1', 'res2', 'res3']) {
            const resourceSection = screen.getByText(resId).closest('div');
            await act(async () => {
                fireEvent.click(resourceSection);
            });
        }

        // Verify provisioned icons
        await waitFor(() => {
            // res1: provisioned.state = "true" → green icon
            const res1Details = screen.getByText('Resource 1').closest('[data-testid="accordion-details"]');
            const res1Icon = within(res1Details).getByTestId('FiberManualRecordIcon');
            expect(res1Icon).toHaveStyle({color: '#4caf50'}); // green[500]

            // res2: provisioned.state = "false" → red icon
            const res2Details = screen.getByText('Resource 2').closest('[data-testid="accordion-details"]');
            const res2Icon = within(res2Details).getByTestId('FiberManualRecordIcon');
            expect(res2Icon).toHaveStyle({color: '#f44336'}); // red[500]

            // res3: provisioned.state = "n/a" → red icon
            const res3Details = screen.getByText('Resource 3').closest('[data-testid="accordion-details"]');
            const res3Icon = within(res3Details).getByTestId('FiberManualRecordIcon');
            expect(res3Icon).toHaveStyle({color: '#f44336'}); // red[500]
        });
    }, 15000);

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Select freeze
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const freezeItem = menuItems.find((item) => item.textContent.includes('Freeze'));
            expect(freezeItem).toBeInTheDocument();
            fireEvent.click(freezeItem);
        });

        // Verify dialog
        await waitFor(() => {
            expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
        });

        // Cancel
        const cancelButton = screen.getByRole('button', {name: /Cancel/i});
        fireEvent.click(cancelButton);

        // Verify dialog closed
        await waitFor(() => {
            expect(screen.queryByText('Confirm Freeze')).not.toBeInTheDocument();
        });
    }, 10000);

    test('shows error snackbar when action fails', async () => {
        global.fetch.mockImplementation(() => Promise.reject(new Error('Network error')));

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Node: node1')).toBeInTheDocument();
        });

        // Select node
        const nodeCheckbox = screen.getAllByRole('checkbox')[0];
        fireEvent.click(nodeCheckbox);

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /Actions on selected nodes/i});
        fireEvent.click(actionsButton);

        // Select start
        await waitFor(() => {
            const menuItems = screen.getAllByRole('menuitem');
            const startItem = menuItems.find((item) => item.textContent.includes('Start'));
            expect(startItem).toBeInTheDocument();
            fireEvent.click(startItem);
        });

        // Confirm
        await waitFor(() => {
            expect(screen.getByText('Confirm start')).toBeInTheDocument();
        });
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify error snackbar
        await waitFor(() => {
            const errorAlert = screen.getByText(/Error: Network error/i);
            expect(errorAlert).toBeInTheDocument();
            expect(errorAlert.closest('[role="alert"]')).toHaveAttribute('data-severity', 'error');
        });
    }, 10000);

    test('displays node state from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('running')).toBeInTheDocument();
            expect(screen.queryByText('idle')).not.toBeInTheDocument();
        });
    });

    test('displays global_expect from instanceMonitor', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        await waitFor(() => {
            expect(screen.getByText('placed@node1')).toBeInTheDocument();
            expect(screen.queryByText('none')).not.toBeInTheDocument();
        });
    });

    test('displays keys in table for cfg object', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const keysAccordion = screen.getByText(/Object Keys \(2\)/i);
            expect(keysAccordion).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(2\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByText('key1')).toBeInTheDocument();
            expect(screen.getByText('key2')).toBeInTheDocument();
            expect(screen.getByText('2626 bytes')).toBeInTheDocument();
            expect(screen.getByText('6946 bytes')).toBeInTheDocument();
            const node1Elements = screen.getAllByText('node1');
            expect(node1Elements).toHaveLength(2);
            node1Elements.forEach((element) => {
                expect(element).toBeInTheDocument();
            });
        });
    });

    test('expands keys accordion', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
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

    test('creates a new key', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(2\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(2\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        const addButton = screen.getByRole('button', {name: /add/i});
        await act(async () => {
            fireEvent.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Create New Key')).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText('Key Name');
        const fileInput = screen.getByLabelText(/file/i);
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'newKey'}});
            fireEvent.change(fileInput, {target: {files: [new File(['content'], 'key.txt')]}});
        });

        const createButton = screen.getByRole('button', {name: /Create/i});
        await act(async () => {
            fireEvent.click(createButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/data/key?name=newKey'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        'Content-Type': 'application/octet-stream',
                    }),
                    body: expect.any(File),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Key 'newKey' created successfully/i)).toBeInTheDocument();
        });
    });

    test('updates a key', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(2\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(2\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        const keyRow = screen.getByText('key1').closest('tr');
        const editButton = within(keyRow).getByRole('button', {name: /edit/i});
        await act(async () => {
            fireEvent.click(editButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Update Key')).toBeInTheDocument();
        });
        const nameInput = screen.getByPlaceholderText('Key Name');
        const fileInput = screen.getByLabelText(/file/i);
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'updatedKey'}});
            fireEvent.change(fileInput, {target: {files: [new File(['new content'], 'updated.txt')]}});
        });

        const updateButton = screen.getByRole('button', {name: /Update/i});
        await act(async () => {
            fireEvent.click(updateButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/data/key?name=updatedKey'),
                expect.objectContaining({
                    method: 'PUT',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                        'Content-Type': 'application/octet-stream',
                    }),
                    body: expect.any(File),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Key 'updatedKey' updated successfully/i)).toBeInTheDocument();
        });
    });

    test('deletes a key', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(2\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(2\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        const keyRow = screen.getByText('key1').closest('tr');
        const deleteButton = within(keyRow).getByRole('button', {name: /delete/i});
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Confirm Delete Key')).toBeInTheDocument();
        });

        const deleteConfirmButton = screen.getByRole('dialog').querySelector('button.MuiButton-containedError');
        await act(async () => {
            fireEvent.click(deleteConfirmButton);
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/data/key?name=key1'),
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                    }),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText(/Key 'key1' deleted successfully/i)).toBeInTheDocument();
        });
    });

    test('displays error when fetching keys fails', async () => {
        global.fetch.mockImplementationOnce(() => Promise.reject(new Error('Failed to fetch keys')));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
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

    test('displays no keys message when keys array is empty', async () => {
        global.fetch.mockImplementationOnce(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({items: []}),
            })
        );
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(0\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        await waitFor(() => {
            expect(screen.getByText('No keys available.')).toBeInTheDocument();
        });
    });

    test('displays loading indicator while fetching keys', async () => {
        global.fetch.mockImplementationOnce(() => new Promise(() => {
        }));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
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
        global.fetch.mockImplementationOnce(() => new Promise(() => {
        }));
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        const keysAccordion = screen.getByText(/Object Keys \(0\)/i).closest('div');
        await act(async () => {
            fireEvent.click(keysAccordion);
        });

        const addButton = screen.getByRole('button', {name: /add/i});
        await act(async () => {
            fireEvent.click(addButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Create New Key')).toBeInTheDocument();
        });

        const nameInput = screen.getByPlaceholderText('Key Name');
        const fileInput = screen.getByLabelText(/file/i);
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'newKey'}});
            fireEvent.change(fileInput, {target: {files: [new File(['content'], 'key.txt')]}});
        });

        const dialog = screen.getByRole('dialog');
        const createButton = within(dialog).getByRole('button', {name: /create/i});
        const cancelButton = within(dialog).getByRole('button', {name: /cancel/i});

        await act(async () => {
            fireEvent.click(createButton);
        });

        await waitFor(() => {
            expect(createButton).toBeDisabled();
            expect(cancelButton).toBeDisabled();
        });
    });
});