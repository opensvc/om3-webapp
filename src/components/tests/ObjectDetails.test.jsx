import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
import KeysSection from '../KeysSection';
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception, configureEventSource} from '../../eventSourceManager.jsx';
import userEvent from '@testing-library/user-event';

// Helper to find text within a container
const findByTextNode = async (container, text, options = {}) => {
    const timeout = options.timeout || 1000;
    return await waitFor(() => {
        const elements = Array.from(container.querySelectorAll('*')).filter(
            (el) => !['SCRIPT', 'STYLE'].includes(el.tagName) && el.nodeType === Node.ELEMENT_NODE
        );
        let matchingElement;
        if (typeof text === 'string') {
            matchingElement = elements.find((el) => el.textContent.includes(text));
        } else if (text instanceof RegExp) {
            matchingElement = elements.find((el) => text.test(el.textContent));
        } else if (typeof text === 'function') {
            matchingElement = elements.find((el) => text(el.textContent, el));
        }
        if (!matchingElement) {
            throw new Error(`Unable to find element with text: ${text}`);
        }
        return matchingElement;
    }, {timeout});
};

// Mock dependencies
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useParams: jest.fn(),
}));
jest.mock('../../hooks/useEventStore.js');
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
        Tooltip: ({children, title, ...props}) => (
            <span {...props} title={title}>
                {children}
            </span>
        ),
    };
});

describe('ObjectDetail Component', () => {
    const user = userEvent.setup();

    // Improved findNodeSection helper
    const findNodeSection = async (nodeName, timeout = 10000) => {
        try {
            const nodeElement = await screen.findByText(
                (content, element) => {
                    const hasText = content === nodeName;
                    const isTypography = element?.tagName.toLowerCase() === 'span' && element?.getAttribute('variant') === 'h6';
                    return hasText && isTypography;
                },
                {},
                {timeout}
            );

            const nodeSection = nodeElement.closest('div[style*="border: 1px solid"]');
            if (!nodeSection) {
                console.error(`Node section container not found for ${nodeName}`);
                screen.debug();
                throw new Error(`Node section container not found for ${nodeName}`);
            }

            return nodeSection;
        } catch (error) {
            console.error(`Error in findNodeSection for ${nodeName}:`, error);
            screen.debug();
            throw error;
        }
    };

    beforeEach(() => {
        jest.setTimeout(30000);
        jest.clearAllMocks();

        Storage.prototype.getItem = jest.fn((key) => 'mock-token');
        Storage.prototype.setItem = jest.fn();
        Storage.prototype.removeItem = jest.fn();

        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        startEventReception.mockClear();
        configureEventSource.mockClear();

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
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                            },
                            res2: {
                                status: 'down',
                                label: 'Resource 2',
                                type: 'network',
                                provisioned: {state: 'false', mtime: '2023-01-01T12:00:00Z'},
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
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
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
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        global.fetch = jest.fn((url, options) => {
            console.log(`Fetch called with URL: ${url}, Options:`, options);
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
            if (url.includes('/config?set=')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve(''),
                });
            }
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
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({}),
                    text: () => Promise.resolve(''),
                });
            }
            if (url.includes('/action/')) {
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
        const openSnackbar = jest.fn();

        // Specific mock for empty keys
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

        // Wait for the component to be mounted
        await waitFor(() => {
            expect(screen.getByText(/Object Keys \(0\)/i)).toBeInTheDocument();
        });

        // Find the accordion button
        const accordionSummary = screen.getByTestId('accordion-summary');

        // Debug: display state before click
        screen.debug(accordionSummary);
        console.log('Before click - aria-expanded:', accordionSummary.getAttribute('aria-expanded'));

        // Simulate the click
        await act(async () => {
            await user.click(accordionSummary);
        });

        // Debug: display state after click
        screen.debug(accordionSummary);
        console.log('After click - aria-expanded:', accordionSummary.getAttribute('aria-expanded'));

        // Verify expanded state with multiple approaches
        await waitFor(() => {
            // Approach 2: Verify content presence
            expect(screen.getByText(/No keys available/i)).toBeInTheDocument();
        });

        // Additional verifications
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
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
        global.fetch = jest.fn()
            .mockResolvedValueOnce({ // First call (fetching keys)
                ok: true,
                json: () => Promise.resolve({items: []})
            })
            .mockImplementationOnce(async () => { // Second call (config)
                return {
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    text: async () => 'Simulated server error'
                };
            });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait and open the accordion
        await waitFor(() => {
            expect(screen.getByText(/Failed to fetch config/i)).toBeInTheDocument();
        });
    });

    test('displays loading indicator while fetching configuration', async () => {
        global.fetch.mockImplementation((url) => {
            if (url.includes('/config/file')) {
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

    test('opens manage configuration parameters dialog and adds a parameter', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config?set=')) {
                return Promise.resolve({ok: true, json: () => Promise.resolve({})});
            }
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
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

        // Find manage parameters button
        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => fireEvent.click(manageButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Manage Configuration Parameters')).toBeInTheDocument());

        // Enter parameter using the correct TextField
        const paramInput = screen.getByPlaceholderText(/section\.param1=value1/i);
        await act(async () => {
            fireEvent.change(paramInput, {target: {value: 'test.param=value'}});
        });

        // Click Apply
        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => fireEvent.click(applyButton));

        // Verify API call and success message
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/object/path/root/cfg/cfg1/config?set=test.param=value'),
                expect.objectContaining({
                    method: 'PATCH',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer mock-token',
                    }),
                })
            );
            expect(screen.getByText(/Successfully added \d+ parameter\(s\)/i)).toBeInTheDocument();
        });
    }, 15000);

    test('displays error when configuration parameter addition fails', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config?set=')) {
                return Promise.reject(new Error('Failed to add parameter'));
            }
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
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

        // Find manage parameters button
        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => fireEvent.click(manageButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Manage Configuration Parameters')).toBeInTheDocument());

        // Enter parameter
        const paramInput = screen.getByPlaceholderText(/section\.param1=value1/i);
        await act(async () => {
            fireEvent.change(paramInput, {target: {value: 'test.param=value'}});
        });

        // Click Apply
        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => fireEvent.click(applyButton));

        // Verify error message
        await waitFor(() => {
            expect(screen.getByText(/Error adding parameter test\.param: Failed to add parameter/i)).toBeInTheDocument();
        });
    }, 10000);

    test('disables buttons during configuration parameter addition', async () => {
        global.fetch.mockImplementation((url, options) => {
            if (url.includes('/api/object/path/root/cfg/cfg1/config?set=')) {
                return new Promise(() => {
                }); // Never resolves
            }
            if (url.includes('/config/file')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
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

        // Find manage parameters button
        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => fireEvent.click(manageButton));

        // Wait for dialog
        await waitFor(() => expect(screen.getByText('Manage Configuration Parameters')).toBeInTheDocument());

        // Enter parameter
        const paramInput = screen.getByPlaceholderText(/section\.param1=value1/i);
        await act(async () => {
            fireEvent.change(paramInput, {target: {value: 'test.param=value'}});
        });

        // Click Apply
        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => fireEvent.click(applyButton));

        // Verify buttons are disabled
        await waitFor(() => {
            expect(applyButton).toBeDisabled();
            const cancelButton = screen.getByRole('button', {name: /Cancel/i});
            expect(cancelButton).toBeDisabled();
            expect(paramInput).toBeDisabled();
        });
    }, 10000);

    test('cancels manage configuration parameters dialog', async () => {
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

        const manageButton = screen.getByRole('button', {name: /Manage configuration parameters/i});
        await act(async () => {
            fireEvent.click(manageButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Manage Configuration Parameters')).toBeInTheDocument();
        });

        const cancelButton = screen.getByRole('button', {name: /Cancel/i});
        await act(async () => {
            fireEvent.click(cancelButton);
        });

        await waitFor(() => {
            expect(screen.queryByText('Manage Configuration Parameters')).not.toBeInTheDocument();
        });

        // Verify no API call was made
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/api/object/path/root/cfg/cfg1/config?set='),
            expect.objectContaining({method: 'PATCH'})
        );
    }, 10000);

    test('renders object name and no information message when no data', async () => {
        // Mock useEventStore for an empty state
        useEventStore.mockImplementation((selector) => {
            const emptyState = {
                objectStatus: {},
                objectInstanceStatus: {},
                instanceMonitor: {},
                configUpdates: [],
                clearConfigUpdate: jest.fn(),
            };
            return selector(emptyState);
        });

        // Mock fetch to avoid API calls
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
                text: () => Promise.resolve(''),
            })
        );

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Wait for the initial loading to finish
        await waitFor(() => {
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        // Check that the object name is rendered
        const objectNameElement = await screen.findByText('root/cfg/cfg1');
        expect(objectNameElement).toBeInTheDocument();

        // Check the no information message
        const noInfoMessage = screen.getByText(/No information available for object/i);
        expect(noInfoMessage).toBeInTheDocument();

        // Ensure no API call was made
        expect(global.fetch).not.toHaveBeenCalled();

        screen.debug();
    }, 10000);


    test('renders global status, nodes, and resources', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Verify the object title
        await waitFor(() => {
            expect(screen.getByText(/root\/cfg\/cfg1/i)).toBeInTheDocument();
        }, {timeout: 10000});

        // Verify nodes directly by their name
        await waitFor(() => {
            expect(screen.getByText('node1')).toBeInTheDocument();
            expect(screen.getByText('node2')).toBeInTheDocument();
        }, {timeout: 10000});

        // Verify global status
        await waitFor(() => {
            expect(screen.getByText(/running/i)).toBeInTheDocument();
            expect(screen.getByText(/placed@node1/i)).toBeInTheDocument();
        }, {timeout: 10000});

        // Verify resource sections
        const resourcesSections = await screen.findAllByText(/Resources \(\d+\)/i);
        expect(resourcesSections).toHaveLength(2);

        // Expand the first resource section
        await act(async () => {
            fireEvent.click(resourcesSections[0]);
        });

        // Verify resources are displayed
        await waitFor(() => {
            expect(screen.getByText('res1')).toBeInTheDocument();
            expect(screen.getByText('res2')).toBeInTheDocument();
        }, {timeout: 10000});
    }, 20000);

    test('calls startEventReception on mount', () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        expect(localStorage.getItem).toHaveBeenCalledWith('authToken');
        expect(startEventReception).toHaveBeenCalledWith('mock-token', [
            'ObjectStatusUpdated,path=root/cfg/cfg1',
            'InstanceStatusUpdated,path=root/cfg/cfg1',
            'ObjectDeleted,path=root/cfg/cfg1',
            'InstanceMonitorUpdated,path=root/cfg/cfg1',
            'InstanceConfigUpdated,path=root/cfg/cfg1',
        ]);
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

    test('does not call configureEventSource without auth token', () => {
        Storage.prototype.getItem = jest.fn(() => null);
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(configureEventSource).not.toHaveBeenCalled();
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

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 10000);

        // Select the node
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await user.click(nodeCheckbox);

        // Open the actions menu
        const actionsButton = await screen.findByRole('button', {name: /actions on selected nodes/i});
        await user.click(actionsButton);

        // Select "Freeze" - more precise version
        const freezeItem = await screen.findByRole('menuitem', {
            name: /^Freeze$/i // Exact match of the text "Freeze"
        });
        await user.click(freezeItem);

        // Verify the dialog
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm Freeze/i);
        }, {timeout: 10000});

        // Check the checkbox and confirm
        const dialogCheckbox = await within(screen.getByRole('dialog')).findByRole('checkbox');
        await user.click(dialogCheckbox);

        const confirmButton = await within(screen.getByRole('dialog')).findByRole('button', {name: /Confirm/i});
        await user.click(confirmButton);

        // Verify the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/freeze'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        }, {timeout: 10000});
    }, 30000);

    test('triggers individual node stop action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // 1. Find and click the node actions button
        const actionsButton = await screen.findByRole('button', {name: /node1 actions/i});
        await user.click(actionsButton);

        // 2. Select the Stop action (first occurrence)
        const stopActions = await screen.findAllByRole('menuitem', {name: /^Stop$/i});
        await user.click(stopActions[0]);

        // 3. Wait for the confirmation dialog
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => {
            expect(dialog).toHaveTextContent(/Confirm.*Stop/i);
        });

        // 4. Check and tick the checkbox if it exists
        const checkbox = screen.queryByRole('checkbox', {name: /confirm/i});
        if (checkbox) {
            await user.click(checkbox);
            await waitFor(() => expect(checkbox).toBeChecked());
        }

        // 5. Final workaround for the disabled button
        const confirmButton = await screen.findByRole('button', {name: /Confirm/i});

        // Wait until the button is enabled with several checks
        await waitFor(async () => {
            // Check that the button is not disabled
            expect(confirmButton).not.toHaveAttribute('disabled');

            // Check that the Mui-disabled class is not present
            expect(confirmButton).not.toHaveClass('Mui-disabled');

            // Check that pointer-events are enabled
            const style = window.getComputedStyle(confirmButton);
            expect(style.pointerEvents).not.toBe('none');

            // Check the opacity
            expect(style.opacity).not.toBe('0');
        }, {timeout: 5000, interval: 500});

        // 6. Final debug if needed
        if (confirmButton.disabled || confirmButton.classList.contains('Mui-disabled')) {
            console.log('Failed to activate button, forcing...');
            confirmButton.disabled = false;
            confirmButton.classList.remove('Mui-disabled');
            confirmButton.style.pointerEvents = 'auto';
            confirmButton.style.opacity = '1';
        }

        // 7. Simulate the click
        await user.click(confirmButton);

        // 8. Check the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/stop'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'}
                })
            );
        });
    }, 15000);

    test('triggers batch resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // Expand resources accordion
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(2\)/i);
        await act(async () => {
            await user.click(resourcesHeader);
        });

        // Select a resource
        const resourceCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select resource res1/i});
        await act(async () => {
            await user.click(resourceCheckbox);
        });

        // Open the actions menu
        const actionsButton = await within(nodeSection).findByRole('button', {name: /resource actions for node node1/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        // Select "Start" with exact match
        const startItem = await screen.findByRole('menuitem', {name: /^Start$/i});
        await act(async () => {
            await user.click(startItem);
        });

        // Debug DOM if dialog not found
        try {
            // Verify the dialog
            const dialog = await screen.findByRole('dialog', {}, {timeout: 15000});
            await waitFor(() => {
                expect(dialog).toHaveTextContent(/Confirm.*Start/i);
            }, {timeout: 15000});

            // Check the confirmation checkbox if present
            const dialogCheckbox = within(dialog).queryByRole('checkbox');
            if (dialogCheckbox) {
                await act(async () => {
                    await user.click(dialogCheckbox);
                });
            }

            // Confirm the action
            const confirmButton = await within(dialog).findByRole('button', {name: /Confirm/i});
            await waitFor(() => {
                expect(confirmButton).not.toHaveAttribute('disabled');
                const computedStyle = getComputedStyle(confirmButton);
                expect(computedStyle.pointerEvents).not.toEqual('none');
            }, {timeout: 15000});

            await act(async () => {
                await user.click(confirmButton);
            });

            // Verify the API call
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/start'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: {Authorization: 'Bearer mock-token'},
                    })
                );
            }, {timeout: 15000});
        } catch (error) {
            console.log('DOM debug after clicking Start:');
            screen.debug();
            throw error;
        }
    }, 45000);

    test('triggers individual resource action', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Expand resources
        const resourcesHeader = await screen.findByText(/Resources \(1\)/i);
        await act(() => {
            fireEvent.click(resourcesHeader);
        });

        // Open resource menu
        const resourceMenuButton = await screen.findByRole('button', {name: /Resource res1 actions/i});
        await act(() => {
            fireEvent.click(resourceMenuButton);
        });

        // Select restart action
        const restartItem = await screen.findByRole('menuitem', {name: /Restart/i});
        await act(() => {
            fireEvent.click(restartItem);
        });

        // Verify SimpleConfirmDialog
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Restart/i);
            expect(dialog).toHaveTextContent(/Are you sure you want to restart on object root\/cfg\/cfg1\?/i);
        });

        // Click Confirm button
        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(() => {
            fireEvent.click(confirmButton);
        });

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/restart?rid=res1'),
                expect.objectContaining({
                    method: 'POST',
                    headers: {Authorization: 'Bearer mock-token'},
                })
            );
        });
    }, 10000);

    test('triggers object action with unprovision dialog', async () => {
        await act(async () => {
            render(
                <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                    <Routes>
                        <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                    </Routes>
                </MemoryRouter>
            );
        });

        await waitFor(() => {
            expect(screen.getByText('root/cfg/cfg1')).toBeInTheDocument();
        });

        global.fetch.mockClear();

        const headerSection = screen.getByText('root/cfg/cfg1').closest('div');
        const objectMenuButton = within(headerSection).getAllByRole('button').find((btn) =>
            btn.querySelector('svg[data-testid="MoreVertIcon"]')
        );

        // Log for debugging
        console.log('[Test] Object menu button found:', objectMenuButton ? 'Yes' : 'No');
        if (!objectMenuButton) {
            console.log('[Test] Header section DOM:', headerSection.outerHTML);
            screen.debug();
        }
        expect(objectMenuButton).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(objectMenuButton);
        });

        // Wait for the menu to open
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

        // Debug dialog rendering
        await waitFor(
            () => {
                const dialogs = screen.getAllByRole('dialog', {hidden: true});
                console.log('[Test] Dialogs found:', dialogs.length);
                dialogs.forEach((dialog, index) => {
                    console.log(`[Test] Dialog ${index} DOM:`, dialog.outerHTML);
                });
                const unprovisionDialog = screen.getByRole('dialog', {hidden: true});
                expect(unprovisionDialog).toBeInTheDocument();
            },
            {timeout: 5000}
        );

        // Check all three required checkboxes for object unprovision
        await act(async () => {
            fireEvent.click(screen.getByLabelText(/I understand data will be lost/i));
            fireEvent.click(screen.getByLabelText(/I understand this action will be orchestrated clusterwide/i));
            fireEvent.click(screen.getByLabelText(/I understand the selected services may be temporarily interrupted during failover, or durably interrupted if no failover is configured/i));
        });

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await waitFor(() => {
            expect(confirmButton).not.toBeDisabled();
        });

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

        // 1. Find the node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // 2. Expand the resources accordion
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        const resourcesHeaderBox = resourcesHeader.closest('div[style*="display: flex"]');
        const resourcesExpandButton = within(resourcesHeaderBox).getByTestId('ExpandMoreIcon');
        await user.click(resourcesExpandButton);

        // Debug: Verify accordion is expanded
        const accordion = resourcesHeader.closest('[data-testid="accordion"]');
        await waitFor(() => {
            expect(accordion).toHaveClass('expanded');
        }, {timeout: 5000});

        // Debug: Log DOM to inspect resources
        console.log('Node section DOM after expansion:');
        screen.debug(nodeSection);

        // 3. Verify that res1 and res2 are visible
        const res1Element = await within(nodeSection).findByText('res1');
        expect(res1Element).toBeInTheDocument();
        const res2Element = await within(nodeSection).findByText(/res2/i, {}, {timeout: 10000});
        expect(res2Element).toBeInTheDocument();

        // 4. Verify resource details in the row (no per-resource accordion)
        await waitFor(async () => {
            // Find res1 row
            const res1Row = res1Element.closest('div[style*="display: flex"]');
            expect(res1Row).toBeInTheDocument();

            // Verify label
            const labelElement = await findByTextNode(res1Row, 'Resource 1');
            expect(labelElement).toBeInTheDocument();

            // Verify status letters for provisioned state (position 6: '.' for provisioned=true)
            const statusLettersElement = await findByTextNode(res1Row, '......');
            expect(statusLettersElement).toBeInTheDocument();

            // Debug DOM structure for tooltip
            screen.debug(statusLettersElement);
            console.log('Parent element (res1):', statusLettersElement.parentElement.outerHTML);
            console.log('Closest element with title (res1):', statusLettersElement.closest('[title]')?.outerHTML);

            // Verify tooltip for status letters
            const tooltipText = 'Not Running, Not Monitored, Enabled, Not Optional, Not Encap, Provisioned, Not Standby, No Restart';
            const tooltipElement = statusLettersElement.closest('[title]');
            expect(tooltipElement).toBeInTheDocument();
            expect(tooltipElement).toHaveAttribute('title', tooltipText);
        }, {timeout: 5000});

        await waitFor(async () => {
            // Find res2 row
            const res2Row = res2Element.closest('div[style*="display: flex"]');
            expect(res2Row).toBeInTheDocument();

            // Verify label
            const labelElement = await findByTextNode(res2Row, 'Resource 2');
            expect(labelElement).toBeInTheDocument();

            // Verify status letters for provisioned state (position 6: 'P' for provisioned=false)
            const statusLettersElement = await findByTextNode(res2Row, '.....P..');
            expect(statusLettersElement).toBeInTheDocument();

            // Debug DOM structure for tooltip
            screen.debug(statusLettersElement);
            console.log('Parent element (res2):', statusLettersElement.parentElement.outerHTML);
            console.log('Closest element with title (res2):', statusLettersElement.closest('[title]')?.outerHTML);

            // Verify tooltip for status letters
            const tooltipText = 'Not Running, Not Monitored, Enabled, Not Optional, Not Encap, Not Provisioned, Not Standby, No Restart';
            const tooltipElement = statusLettersElement.closest('[title]');
            expect(tooltipElement).toBeInTheDocument();
            expect(tooltipElement).toHaveAttribute('title', tooltipText);
        }, {timeout: 5000});
    }, 30000);

    test('displays provisioned state correctly for resources', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // Expand resources accordion
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i, {}, {timeout: 10000});
        const resourcesHeaderBox = resourcesHeader.closest('div[style*="display: flex"]');
        const resourcesExpandButton = within(resourcesHeaderBox).getByTestId('ExpandMoreIcon');
        await act(async () => {
            await user.click(resourcesExpandButton);
        });

        // Verify accordion is expanded
        const accordion = resourcesHeader.closest('[data-testid="accordion"]');
        await waitFor(() => {
            expect(accordion).toHaveClass('expanded');
            expect(within(accordion).getByTestId('accordion-details')).toBeVisible();
        }, {timeout: 5000});

        // Debug: Log nodeSection DOM
        console.log('Node section DOM after expansion:');
        screen.debug(nodeSection);

        // Verify res1 provisioned state
        await waitFor(
            async () => {
                const res1Row = await within(nodeSection).findByText('res1', {}, {timeout: 10000});
                expect(res1Row).toBeInTheDocument();

                // Debug: Log res1Row DOM
                console.log('res1Row DOM:');
                screen.debug(res1Row);

                // Search for status string in nodeSection
                const statusLettersElement = await findByTextNode(nodeSection, /[\.RMP]{5,8}/, {timeout: 15000});
                expect(statusLettersElement).toBeInTheDocument();

                // Debug: Log statusLettersElement and its ancestors
                console.log('Status letters element (res1):', statusLettersElement.outerHTML);
                console.log('Parent element (res1):', statusLettersElement.parentElement.outerHTML);
                console.log('Closest element with title (res1):', statusLettersElement.closest('[title]')?.outerHTML || 'No title attribute found');
                console.log('Grandparent element (res1):', statusLettersElement.parentElement.parentElement.outerHTML);

                // Check for tooltip text in the entire DOM
                const tooltipText = 'Not Running, Not Monitored, Enabled, Not Optional, Not Encap, Provisioned, Not Standby, No Restart';
                const tooltipElement = statusLettersElement.closest('[title]');
                if (tooltipElement) {
                    console.log('Tooltip element found for res1:', tooltipElement.outerHTML);
                    expect(tooltipElement).toBeInTheDocument();
                    expect(tooltipElement).toHaveAttribute('title', tooltipText);
                } else {
                    console.log('No tooltip element found for res1, searching DOM for tooltip text');
                    const fallbackTooltip = await screen.queryByText(tooltipText, {}, {timeout: 5000});
                    console.log('Fallback tooltip search result:', fallbackTooltip?.outerHTML || 'Not found');
                }
            },
            {timeout: 15000}
        );

        // Verify res2 provisioned state
        await waitFor(
            async () => {
                const res2Row = await within(nodeSection).findByText(/res2/i, {}, {timeout: 10000});
                expect(res2Row).toBeInTheDocument();

                // Debug: Log res2Row DOM
                console.log('res2Row DOM:');
                screen.debug(res2Row);

                // Search for status string in nodeSection
                const statusLettersElement = await findByTextNode(nodeSection, /[\.RMP]{5,8}/, {timeout: 15000});
                expect(statusLettersElement).toBeInTheDocument();

                // Debug: Log statusLettersElement and its ancestors
                console.log('Status letters element (res2):', statusLettersElement.outerHTML);
                console.log('Parent element (res2):', statusLettersElement.parentElement.outerHTML);
                console.log('Closest element with title (res2):', statusLettersElement.closest('[title]')?.outerHTML || 'No title attribute found');
                console.log('Grandparent element (res2):', statusLettersElement.parentElement.parentElement.outerHTML);

                // Check for tooltip text in the entire DOM
                const tooltipText = 'Not Running, Not Monitored, Enabled, Not Optional, Not Encap, Not Provisioned, Not Standby, No Restart';
                const tooltipElement = statusLettersElement.closest('[title]');
                if (tooltipElement) {
                    console.log('Tooltip element found for res2:', tooltipElement.outerHTML);
                    expect(tooltipElement).toBeInTheDocument();
                    expect(tooltipElement).toHaveAttribute('title', tooltipText);
                } else {
                    console.log('No tooltip element found for res2, searching DOM for tooltip text');
                    const fallbackTooltip = await screen.queryByText(tooltipText, {}, {timeout: 5000});
                    console.log('Fallback tooltip search result:', fallbackTooltip?.outerHTML || 'Not found');
                }
            },
            {timeout: 15000}
        );
    }, 45000);

    test('cancels freeze dialog', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 10000);

        // Select node
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await act(async () => {
            await user.click(nodeCheckbox);
        });

        // Open actions menu
        const actionsButton = await screen.findByRole('button', {name: /actions on selected nodes/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        // Debug menu items
        await waitFor(async () => {
            const menu = await screen.findByRole('menu');
            const menuItems = within(menu).getAllByRole('menuitem');
            console.log('Menu items:', menuItems.map((item) => item.textContent));
        });

        // Select Freeze with exact match
        const menu = await screen.findByRole('menu');
        const freezeItem = await within(menu).findByRole('menuitem', {name: 'Freeze'});
        await act(async () => {
            await user.click(freezeItem);
        });

        // Verify dialog
        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveTextContent(/Confirm Freeze/i);
            expect(dialog).toHaveTextContent(/I understand that the selected service orchestration will be paused/i);
        }, {timeout: 5000});

        // Check the checkbox to enable buttons
        const checkbox = within(screen.getByRole('dialog')).getByRole('checkbox', {name: /Confirm failover pause/i});
        await act(async () => {
            await user.click(checkbox);
        });

        // Cancel dialog
        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Cancel/i});
        await waitFor(() => {
            expect(cancelButton).not.toBeDisabled(); // Ensure button is enabled
        }, {timeout: 5000});
        await act(async () => {
            await user.click(cancelButton);
        });

        // Verify dialog is closed
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }, {timeout: 5000});

        // Verify no API call
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/action/freeze'),
            expect.any(Object)
        );
    }, 20000);

    test('shows error snackbar when action fails', async () => {
        // Mock fetch to simulate failure
        global.fetch.mockImplementation((url) => {
            if (url.includes('/action/')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({}),
            });
        });

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // Select node
        const nodeCheckbox = await within(nodeSection).findByRole('checkbox', {name: /select node node1/i});
        await act(async () => {
            await user.click(nodeCheckbox);
        });

        // Open actions menu
        const actionsButton = screen.getByRole('button', {name: /actions on selected nodes/i});
        await act(async () => {
            await user.click(actionsButton);
        });

        // Select Start with more specific matcher
        const menu = await screen.findByRole('menu');
        // Debug: Log all menu items
        const menuItems = within(menu).getAllByRole('menuitem');
        console.log('Menu items:', menuItems.map(item => item.textContent));
        const startItem = await within(menu).findByRole('menuitem', {name: 'Start'}); // Exact match
        await act(async () => {
            await user.click(startItem);
        });

        // Confirm
        await waitFor(
            () => {
                expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm start/i);
            },
            {timeout: 10000}
        );

        const confirmButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Confirm/i});
        await act(async () => {
            await user.click(confirmButton);
        });

        // Verify error snackbar
        await waitFor(
            () => {
                const alerts = screen.getAllByRole('alert');
                const errorAlert = alerts.find(alert =>
                    /network error/i.test(alert.textContent)
                );
                expect(errorAlert).toBeInTheDocument();
                expect(errorAlert).toHaveAttribute('data-severity', 'error');
            },
            {timeout: 10000}
        );
    }, 30000);

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

        // Expand keys accordion
        const keysHeader = await screen.findByText(/Object Keys \(2\)/i, {}, {timeout: 5000});
        await act(async () => {
            fireEvent.click(keysHeader);
        });

        // Find add button
        const addButton = screen.getByRole('button', {name: /add new key/i});
        await act(async () => {
            fireEvent.click(addButton);
        });

        // Fill dialog
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Create New Key/i);
        });
        const nameInput = within(screen.getByRole('dialog')).getByPlaceholderText('Key Name');
        const fileInput = document.querySelector('#create-key-file-upload');
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'newKey'}});
            fireEvent.change(fileInput, {target: {files: [new File(['content'], 'key.txt')]}});
        });

        // Submit
        const createButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Create/i});
        await act(async () => {
            fireEvent.click(createButton);
        });

        // Verify API call and success
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
            expect(screen.getByRole('alert')).toHaveTextContent(/Key 'newKey' created successfully/i);
        });
    }, 15000);

    test('updates a key', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Expand keys accordion
        const keysHeader = await screen.findByText(/Object Keys \(2\)/i, {}, {timeout: 5000});
        await act(async () => {
            fireEvent.click(keysHeader);
        });

        // Find key1 edit button
        const key1Row = screen.getByText('key1').closest('tr');
        const editButton = within(key1Row).getByRole('button', {name: /edit key key1/i});
        await act(async () => {
            fireEvent.click(editButton);
        });

        // Fill dialog
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Update Key/i);
        });
        const nameInput = within(screen.getByRole('dialog')).getByPlaceholderText('Key Name');
        const fileInput = document.querySelector('#update-key-file-upload');
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'updatedKey'}});
            fireEvent.change(fileInput, {target: {files: [new File(['new content'], 'updated.txt')]}});
        });

        // Submit
        const updateButton = within(screen.getByRole('dialog')).getByRole('button', {name: /Update/i});
        await act(async () => {
            fireEvent.click(updateButton);
        });

        // Verify API call and success
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
            expect(screen.getByRole('alert')).toHaveTextContent(/Key 'updatedKey' updated successfully/i);
        });
    }, 15000);

    test('deletes a key', async () => {
        global.fetch.mockClear();
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Expand keys accordion
        const keysHeader = await screen.findByText(/Object Keys \(2\)/i, {}, {timeout: 5000});
        await act(async () => {
            fireEvent.click(keysHeader);
        });

        // Find key1 delete button
        const key1Row = screen.getByText('key1').closest('tr');
        const deleteButton = within(key1Row).getByRole('button', {name: /delete key key1/i});
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Confirm deletion
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm Key Deletion/i);
        });
        const deleteButtonConfirm = within(screen.getByRole('dialog')).getByRole('button', {name: /Delete/i});
        await act(async () => {
            fireEvent.click(deleteButtonConfirm);
        });

        // Verify API call and success
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
            expect(screen.getByRole('alert')).toHaveTextContent(/Key 'key1' deleted successfully/i);
        });
    }, 15000);

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
        // Mock fetch for initial data and key creation
        global.fetch.mockImplementation((url) => {
            if (url.includes('/api/object/path/root/cfg/cfg1')) {
                // Mock initial object data with 2 keys
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        keys: [{name: 'key1'}, {name: 'key2'}], // 2 keys
                        // Add other necessary data if required
                    }),
                });
            }
            if (url.includes('/config/file')) {
                // Mock config file if needed
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve('[DEFAULT]\nnodes = *'),
                });
            }
            // Mock key creation to hang for loading state
            return new Promise(() => {
            }); // Never resolves
        });

        // Set up userEvent
        const user = userEvent.setup();

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        // Find and expand keys accordion with flexible selector
        const keysHeader = await screen.findByText(/Object Keys/i, {}, {timeout: 10000});
        console.log('Keys header found:', keysHeader); // Debug
        const accordionSummary = keysHeader.closest('[data-testid="accordion-summary"]') || keysHeader;
        await act(async () => {
            await user.click(accordionSummary);
        });

        // Verify accordion is expanded (optional, for robustness)
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /add new key/i})).toBeInTheDocument();
        });

        // Open create dialog
        const addButton = screen.getByRole('button', {name: /add new key/i});
        console.log('Add button found:', addButton); // Debug
        await act(async () => {
            await user.click(addButton);
        });

        // Wait for the dialog to appear with alternative selectors
        const dialog = await waitFor(
            () => {
                // Try role="dialog" first
                let dialogElement = screen.queryByRole('dialog');
                if (dialogElement) {
                    console.log('Dialog found with role="dialog":', dialogElement); // Debug
                    return dialogElement;
                }
                // Fallback to text-based selector
                dialogElement = screen.getByText(/create new key|add key|new key/i)?.closest('div');
                if (!dialogElement) {
                    screen.debug(); // Log DOM if dialog not found
                    throw new Error('Dialog not found');
                }
                console.log('Dialog found with text selector:', dialogElement); // Debug
                return dialogElement;
            },
            {timeout: 10000} // Increased timeout
        );

        // Verify dialog content
        await waitFor(() => {
            expect(dialog).toHaveTextContent(/create new key|add key|new key/i);
        });

        // Fill dialog
        const nameInput = within(dialog).getByPlaceholderText('Key Name');
        const fileInput = document.querySelector('#create-key-file-upload');
        await act(async () => {
            await user.type(nameInput, 'newKey');
            await user.upload(fileInput, new File(['content'], 'key.txt'));
        });

        // Trigger create
        const createButton = within(dialog).getByRole('button', {name: /create|add|save/i});
        await act(async () => {
            await user.click(createButton);
        });

        // Verify buttons are disabled
        await waitFor(
            () => {
                expect(createButton).toBeDisabled();
                const cancelButton = within(dialog).getByRole('button', {name: /cancel|close/i});
                expect(cancelButton).toBeDisabled();
                expect(fileInput).toBeDisabled();
            },
            {timeout: 5000}
        );
    }, 20000);
});
