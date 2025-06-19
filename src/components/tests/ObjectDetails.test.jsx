import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails';
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
                    json: () =>
                        Promise.resolve({
                            items: [
                                {name: 'key1', node: 'node1', size: 2626},
                                {name: 'key2', node: 'node1', size: 6946},
                            ],
                        }),
                });
            }
            if (url.includes('/config?set=')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }
            if (url.includes('/config/file')) {
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
            if (url.includes('/data/key')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                });
            }
            if (url.includes('/action/')) {
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

    test('displays no keys message when keys array is empty', async () => {
        // 1. Mock setup with extended timeout
        jest.setTimeout(30000);

        // Mock useEventStore with minimal but complete data
        useEventStore.mockImplementation((selector) => selector({
            objectStatus: {
                'root/cfg/cfg1': {
                    avail: 'up',
                    frozen: 'unfrozen',
                    overall: 'ok'
                }
            },
            objectInstanceStatus: {
                'root/cfg/cfg1': {
                    node1: {
                        avail: 'up',
                        frozen_at: null,
                        resources: {},
                        provisioned: true
                    }
                }
            },
            instanceMonitor: {
                'node1:root/cfg/cfg1': {
                    state: 'idle',
                    global_expect: 'none'
                }
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn()
        }));

        // Mock fetch with empty response for keys
        global.fetch.mockImplementation((url) => {
            if (url.includes('/data/keys')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({items: []})
                });
            }
            // Default response for other endpoints
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({})
            });
        });

        // 2. Render the component
        const {container} = render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        try {
            // 3. Wait for component initialization
            await waitFor(() => {
                expect(screen.getByText('root/cfg/cfg1')).toBeInTheDocument();
            }, {timeout: 5000});

            // 4. Optimized search for keys accordion
            const keysAccordionButton = await waitFor(() => {
                const buttons = screen.getAllByRole('button');
                const accordionButton = buttons.find(btn =>
                    btn.textContent?.includes('Object Keys') &&
                    btn.textContent?.includes('(0)')
                );
                if (!accordionButton) {
                    screen.debug(container);
                    throw new Error('Accordion button not found');
                }
                return accordionButton;
            }, {timeout: 5000});

            // 5. Interact with accordion
            await act(async () => {
                fireEvent.click(keysAccordionButton);
            });

            // 6. Verify expanded content
            await waitFor(() => {
                // More robust message verification
                const noKeysMessage = screen.getByText((content, element) => {
                    return content.includes('No keys available') &&
                        element?.tagName.toLowerCase() !== 'button';
                });
                expect(noKeysMessage).toBeInTheDocument();
            }, {timeout: 5000});

        } finally {
            // Cleanup
            jest.clearAllMocks();
        }
    }, 30000);

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
            if (url.includes('/config/file')) {
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
        // Setup fetch mock
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

        // Enter parameter
        const paramInput = screen.getByPlaceholderText(/Parameter \(e.g., test.test.param=value\)/i);
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
            expect(screen.getByText(/Parameter 'test.param' added successfully/i)).toBeInTheDocument();
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
        const paramInput = screen.getByPlaceholderText(/Parameter \(e.g., test.test.param=value\)/i);
        await act(async () => {
            fireEvent.change(paramInput, {target: {value: 'test.param=value'}});
        });

        // Click Apply
        const applyButton = screen.getByRole('button', {name: /Apply/i});
        await act(async () => fireEvent.click(applyButton));

        // Verify error message
        await waitFor(() => {
            expect(screen.getByText(/Error: Failed to add parameter/i)).toBeInTheDocument();
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
        const paramInput = screen.getByPlaceholderText(/Parameter \(e.g., test.test.param=value\)/i);
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

    test('calls configureEventSource on mount', () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );
        expect(configureEventSource).toHaveBeenCalledWith('mock-token', 'root/cfg/cfg1');
    });

    test('calls configureEventSource on unmount to reset filters', async () => {
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
        expect(configureEventSource).toHaveBeenCalledWith('mock-token');
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

        // Find node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // Open the node menu
        const nodeMenuButton = await within(nodeSection).findByRole('button', {name: /node node1 actions/i});
        await act(async () => {
            await user.click(nodeMenuButton);
        });

        // Select "Stop" with exact match
        const stopItem = await screen.findByRole('menuitem', {name: /^Stop$/i});
        await act(async () => {
            await user.click(stopItem);
        });

        // Debug DOM if dialog not found
        try {
            // Verify the dialog
            const dialog = await screen.findByRole('dialog', {}, {timeout: 15000});
            await waitFor(() => {
                expect(dialog).toHaveTextContent(/Confirm.*Stop/i);
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
                    expect.stringContaining('/api/node/name/node1/instance/path/root/cfg/cfg1/action/stop'),
                    expect.objectContaining({
                        method: 'POST',
                        headers: {Authorization: 'Bearer mock-token'},
                    })
                );
            }, {timeout: 15000});
        } catch (error) {
            console.log('DOM debug after clicking Stop:');
            screen.debug();
            throw error;
        }
    }, 45000);

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
        const resourcesHeaders = await screen.findAllByText(/Resources \(\d+\)/i);
        await act(async () => {
            fireEvent.click(resourcesHeaders[0]);
        });

        // Find the resource menu
        const resourceMenus = await screen.findAllByRole('button', {
            name: /Resource res1 actions/i,
        });
        expect(resourceMenus.length).toBeGreaterThan(0);

        await act(async () => {
            fireEvent.click(resourceMenus[0]);
        });

        // Select the restart action
        await waitFor(() => {
            const restartItem = screen.getByRole('menuitem', {name: /Restart/i});
            expect(restartItem).toBeInTheDocument();
            fireEvent.click(restartItem);
        });

        // Confirm the action
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toHaveTextContent('Confirm restart');
        });

        const confirmButton = screen.getByRole('button', {name: /Confirm/i});
        await act(async () => {
            fireEvent.click(confirmButton);
        });

        // Verify the API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/action/restart?rid=res1'),
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

        // 1. Find the node1 section
        const nodeSection = await findNodeSection('node1', 15000);

        // 2. Expand the resources accordion
        const resourcesHeader = await within(nodeSection).findByText(/Resources \(\d+\)/i);
        await user.click(resourcesHeader);

        // 3. Verify that res1 is visible
        const res1Element = await within(nodeSection).findByText('res1');
        expect(res1Element).toBeInTheDocument();

        // 4. Expand the res1 accordion
        const res1Accordion = res1Element.closest('[data-testid="accordion"]');
        const res1Summary = within(res1Accordion).getByTestId('accordion-summary');
        await user.click(res1Summary);

        // 5. Verify the resource details
        await waitFor(async () => {
            // Find the accordion details
            const detailsContainer = within(res1Accordion).getByTestId('accordion-details');
            expect(detailsContainer).toBeInTheDocument();

            // Use a custom matcher to find text nodes containing 'Label:'
            const labelElement = await findByTextNode(detailsContainer, (content) => /Label:/i.test(content));
            expect(labelElement).toBeInTheDocument();
            expect(labelElement.textContent).toContain('Resource 1');

            // Similarly for 'Type:'
            const typeElement = await findByTextNode(detailsContainer, (content) => /Type:/i.test(content));
            expect(typeElement).toBeInTheDocument();
            expect(typeElement.textContent).toContain('disk');

            // Find the provisioned status icon
            const provisionedElement = await findByTextNode(detailsContainer, (content) => /Provisioned:/i.test(content));
            const statusIcon = provisionedElement.querySelector('[data-testid="FiberManualRecordIcon"]');
            expect(statusIcon).toBeInTheDocument();
            expect(statusIcon).toHaveStyle({color: '#4caf50'});
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
        await act(async () => {
            await user.click(resourcesHeader);
        });

        // Expand res1 accordion
        const res1Header = within(nodeSection).getByText('res1');
        const res1Accordion = res1Header.closest('[data-testid="accordion"]');
        await act(async () => {
            await user.click(res1Header.closest('[data-testid="accordion-summary"]') || res1Header);
        });

        // Verify res1 provisioned state
        await waitFor(
            () => {
                const res1Details = within(res1Accordion).getByTestId('accordion-details');
                const provisionedText = within(res1Details).getByText(/Provisioned:/i);
                const icon = provisionedText.closest('span').querySelector('[data-testid="FiberManualRecordIcon"]');
                expect(icon).toHaveStyle({color: '#4caf50'}); // Green for provisioned=true
            },
            {timeout: 10000}
        );

        // Expand res2 accordion
        const res2Header = within(nodeSection).getByText('res2');
        const res2Accordion = res2Header.closest('[data-testid="accordion"]');
        await act(async () => {
            await user.click(res2Header.closest('[data-testid="accordion-summary"]') || res2Header);
        });

        // Verify res2 provisioned state
        await waitFor(
            () => {
                const res2Details = within(res2Accordion).getByTestId('accordion-details');
                const provisionedText = within(res2Details).getByText(/Provisioned:/i);
                const icon = provisionedText.closest('span').querySelector('[data-testid="FiberManualRecordIcon"]');
                expect(icon).toHaveStyle({color: '#f44336'}); // Red for provisioned=false
            },
            {timeout: 10000}
        );
    }, 30000);

    test('cancels freeze dialog', async () => {
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

        // Select Freeze (use more specific selector)
        const menu = await screen.findByRole('menu');
        const freezeItem = await within(menu).findByRole('menuitem', {name: 'Freeze'});
        await act(async () => {
            await user.click(freezeItem);
        });

        // Verify dialog
        await waitFor(
            () => {
                expect(screen.getByRole('dialog')).toHaveTextContent(/Confirm Freeze/i);
            },
            {timeout: 10000}
        );

        // Cancel
        const cancelButton = within(screen.getByRole('dialog')).getByRole('button', {name: /cancel/i});
        await act(async () => {
            await user.click(cancelButton);
        });

        // Verify dialog is closed
        await waitFor(
            () => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            },
            {timeout: 10000}
        );

        // Verify no API call
        expect(global.fetch).not.toHaveBeenCalledWith(
            expect.stringContaining('/action/freeze'),
            expect.any(Object)
        );
    }, 30000);

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
        // Mock fetch to hang for loading state
        global.fetch.mockImplementationOnce(() => new Promise(() => {
        }));

        // Set up userEvent
        const user = userEvent.setup();

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
            await user.click(keysHeader);
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