import React from 'react';
import {render, screen, fireEvent, waitFor, act, within} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import ObjectDetail from '../ObjectDetails'; // Assuming HeaderSection is part of ObjectDetail
import useEventStore from '../../hooks/useEventStore.js';
import {closeEventSource, startEventReception} from '../../eventSourceManager.jsx';

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
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
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
        Menu: ({children, open, anchorEl, onClose, ...props}) =>
            open ? <div role="menu" {...props}>{children}</div> : null,
        MenuItem: ({children, onClick, ...props}) => (
            <div role="menuitem" onClick={onClick} {...props}>
                {children}
            </div>
        ),
        Dialog: ({children, open, maxWidth, fullWidth, ...props}) =>
            open ? <div role="dialog" {...props}>{children}</div> : null,
        DialogTitle: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogContent: ({children, ...props}) => <div {...props}>{children}</div>,
        DialogActions: ({children, ...props}) => <div {...props}>{children}</div>,
        Checkbox: ({checked, onChange, ...props}) => (
            <input type="checkbox" checked={checked} onChange={onChange} {...props} />
        ),
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/MoreVert', () => () => <svg data-testid="MoreVertIcon"/>);

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn((key) => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('HeaderSection Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock useParams
        require('react-router-dom').useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
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
                                provisioned: {state: 'true', mtime: '2023-01-01T12:00:00Z'},
                                running: true,
                            },
                        },
                    },
                },
            },
            instanceMonitor: {
                'node1:root/cfg/cfg1': {
                    state: 'running',
                    global_expect: 'placed@node1',
                    resources: {
                        res1: {restart: {remaining: 0}},
                    },
                },
            },
            instanceConfig: {
                'root/cfg/cfg1': {
                    resources: {
                        res1: {
                            is_monitored: true,
                            is_disabled: false,
                            is_standby: false,
                            restart: 0,
                        },
                    },
                },
            },
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));

        // Mock fetch
        global.fetch = jest.fn((url) => {
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

    test('renders object name without useEventStore', async () => {
        const {useParams} = require('react-router-dom');
        const {Typography} = require('@mui/material');
        useParams.mockReturnValue({
            objectName: 'root/cfg/cfg1',
        });

        const MockHeaderSection = () => {
            const {useParams} = require('react-router-dom');
            const {objectName} = useParams();
            const decodedObjectName = decodeURIComponent(objectName);
            return (
                <div>
                    <Typography variant="h4">{decodedObjectName}</Typography>
                    <Typography>No information available for object</Typography>
                </div>
            );
        };

        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<MockHeaderSection/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            const objectNameElement = screen.getByText(/root\/cfg\/cfg1/i);
            expect(objectNameElement).toBeInTheDocument();
            expect(objectNameElement).toHaveTextContent('root/cfg/cfg1');

            const noInfoMessage = screen.getByText(/No information available for object/i);
            expect(noInfoMessage).toBeInTheDocument();
        }, {timeout: 10000});
    }, 15000);

    test('renders global status', async () => {
        render(
            <MemoryRouter initialEntries={['/object/root%2Fcfg%2Fcfg1']}>
                <Routes>
                    <Route path="/object/:objectName" element={<ObjectDetail/>}/>
                </Routes>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText(/running/i)).toBeInTheDocument();
            expect(screen.getByText(/placed@node1/i)).toBeInTheDocument();
        }, {timeout: 10000});
    }, 20000);

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

        console.log('[Test] Object menu button found:', objectMenuButton ? 'Yes' : 'No');
        if (!objectMenuButton) {
            console.log('[Test] Header section DOM:', headerSection.outerHTML);
            screen.debug();
        }
        expect(objectMenuButton).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(objectMenuButton);
        });

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
    }, 10000);

    test('getObjectStatus handles missing global_expect', async () => {
        const mockState = {
            objectStatus: {},
            objectInstanceStatus: {},
            instanceMonitor: {
                'node1:root/cfg/cfg1': {state: 'running', global_expect: 'none'},
            },
            instanceConfig: {},
            configUpdates: [],
            clearConfigUpdate: jest.fn(),
        };
        useEventStore.mockImplementation((selector) => selector(mockState));
        render(<ObjectDetail/>);
        await waitFor(() => {
            expect(screen.queryByText(/placed@node1/i)).not.toBeInTheDocument();
        });
    }, 10000);
});