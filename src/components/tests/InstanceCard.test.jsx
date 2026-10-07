import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {grey} from '@mui/material/colors';
import {vi} from 'vitest';
import InstanceCard from '../InstanceCard.jsx';

// ── Hoisted logger mock ─────────────────────────────────────────────────
const {mockLogger} = vi.hoisted(() => ({
    mockLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}));

// ── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../utils/logger.js', () => ({
    default: mockLogger,
}));

vi.mock('@mui/material', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Checkbox: ({checked, onChange, ...props}) => (
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                aria-label={props['aria-label']}
                {...props}
            />
        ),
        IconButton: ({children, onClick, disabled, ...props}) => (
            <button onClick={onClick} disabled={disabled} aria-label={props['aria-label']} {...props}>
                {children}
            </button>
        ),
        Box: ({children, onClick, onMouseEnter, onMouseLeave, ...props}) => (
            <div onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} {...props}>
                {children}
            </div>
        ),
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
        Tooltip: ({children, title, ...props}) => (
            <span {...props} title={title}>
                {children}
            </span>
        ),
    };
});

vi.mock('@mui/icons-material/AcUnit', () => ({
    default: () => <span data-testid="AcUnitIcon"/>,
}));
vi.mock('@mui/icons-material/MoreVert', () => ({
    default: () => <span data-testid="MoreVertIcon"/>,
}));
vi.mock('@mui/icons-material/Article', () => ({
    default: () => <span data-testid="ArticleIcon"/>,
}));
vi.mock('@mui/icons-material/PriorityHigh', () => ({
    default: () => <span data-testid="PriorityHighIcon"/>,
}));
vi.mock('@mui/icons-material/FiberManualRecord', () => ({
    default: () => <span data-testid="FiberManualRecordIcon"/>,
}));
vi.mock('@mui/icons-material/Stop', () => ({
    default: () => <span data-testid="StopIcon"/>,
}));
vi.mock('@mui/icons-material/SyncProblem', () => ({
    default: () => <span data-testid="SyncProblemIcon"/>,
}));

// Helper: returns the title attribute of the Tooltip wrapping a given icon
const tooltipTitleFor = (iconTestId) => {
    const icon = screen.getByTestId(iconTestId);
    const wrapper = icon.closest('[title]');
    return wrapper ? wrapper.getAttribute('title') : null;
};

describe('InstanceCard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders node name correctly', () => {
        render(
            <MemoryRouter>
                <InstanceCard node="node1"/>
            </MemoryRouter>
        );
        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('renders node with provided nodeData', () => {
        const nodeData = {instanceName: 'instance1', provisioned: true};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );
        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('calls toggleNode when checkbox is clicked', async () => {
        const toggleNode = vi.fn();
        render(
            <MemoryRouter>
                <InstanceCard node="node1" toggleNode={toggleNode}/>
            </MemoryRouter>
        );
        const checkbox = screen.getByLabelText(/select node node1/i);
        await user.click(checkbox);
        expect(toggleNode).toHaveBeenCalledWith('node1');
    });

    test('calls onOpenLogs when logs button is clicked', async () => {
        const onOpenLogs = vi.fn();
        const nodeData = {instanceName: 'instance1'};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData} onOpenLogs={onOpenLogs}/>
            </MemoryRouter>
        );
        const logsButton = screen.getByLabelText(/View logs for instance instance1/i);
        await user.click(logsButton);
        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'instance1');
    });

    test('calls onViewInstance when card is clicked (except on interactive elements)', async () => {
        const onViewInstance = vi.fn();
        render(
            <MemoryRouter>
                <InstanceCard node="node1" onViewInstance={onViewInstance}/>
            </MemoryRouter>
        );
        await user.click(screen.getByText('node1'));
        expect(onViewInstance).toHaveBeenCalledWith('node1');
    });

    test('does not call onViewInstance when interactive elements are clicked', async () => {
        const onViewInstance = vi.fn();
        render(
            <MemoryRouter>
                <InstanceCard node="node1" onViewInstance={onViewInstance}/>
            </MemoryRouter>
        );
        await user.click(screen.getByLabelText(/select node node1/i));
        await user.click(screen.getByLabelText(/View logs for instance node1/i));
        await user.click(screen.getByLabelText(/Node node1 actions/i));
        expect(onViewInstance).not.toHaveBeenCalled();
    });

    test('opens node actions menu when actions button is clicked', async () => {
        const setCurrentNode = vi.fn();
        const setIndividualNodeMenuAnchor = vi.fn();
        render(
            <MemoryRouter>
                <InstanceCard
                    node="node1"
                    setCurrentNode={setCurrentNode}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByLabelText(/Node node1 actions/i));
        expect(setCurrentNode).toHaveBeenCalledWith('node1');
        expect(setIndividualNodeMenuAnchor).toHaveBeenCalled();
    });

    test('displays node status using getColor function', () => {
        const getColor = vi.fn(() => grey[500]);
        const getNodeState = vi.fn(() => ({avail: 'up', frozen: 'unfrozen', state: null}));
        render(
            <MemoryRouter>
                <InstanceCard node="node1" getColor={getColor} getNodeState={getNodeState}/>
            </MemoryRouter>
        );
        expect(getColor).toHaveBeenCalledWith('up');
        expect(getNodeState).toHaveBeenCalledWith('node1');
    });

    test('shows frozen icon when node is frozen', () => {
        const getNodeState = vi.fn(() => ({avail: 'up', frozen: 'frozen', state: null}));
        render(
            <MemoryRouter>
                <InstanceCard node="node1" getNodeState={getNodeState}/>
            </MemoryRouter>
        );
        expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
    });

    test('shows not provisioned icon when instance is not provisioned (false)', () => {
        const nodeData = {provisioned: false};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );
        expect(screen.getByTestId('PriorityHighIcon')).toBeInTheDocument();
    });

    test('shows not provisioned icon when instance is not provisioned ("false")', () => {
        const nodeData = {provisioned: 'false'};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );
        expect(screen.getByTestId('PriorityHighIcon')).toBeInTheDocument();
    });

    test('does NOT show not provisioned icon when provisioned is "n/a"', () => {
        const nodeData = {provisioned: 'n/a'};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );
        expect(screen.queryByTestId('PriorityHighIcon')).not.toBeInTheDocument();
    });

    test('does NOT show not provisioned icon when provisioned is true', () => {
        const nodeData = {provisioned: true};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );
        expect(screen.queryByTestId('PriorityHighIcon')).not.toBeInTheDocument();
    });

    test('displays node state when available', () => {
        const getNodeState = vi.fn(() => ({avail: 'up', frozen: 'unfrozen', state: 'running'}));
        render(
            <MemoryRouter>
                <InstanceCard node="node1" getNodeState={getNodeState}/>
            </MemoryRouter>
        );
        expect(screen.getByText('running')).toBeInTheDocument();
    });

    test('handles default functions gracefully', () => {
        render(
            <MemoryRouter>
                <InstanceCard node="node1"/>
            </MemoryRouter>
        );
        fireEvent.click(screen.getByLabelText(/select node node1/i));
        expect(mockLogger.warn).toHaveBeenCalledWith('toggleNode not provided');

        fireEvent.click(screen.getByLabelText(/View logs for instance node1/i));
        expect(mockLogger.warn).toHaveBeenCalledWith('onOpenLogs not provided');
    });

    test('does not show view instance button when onViewInstance is not provided', () => {
        render(
            <MemoryRouter>
                <InstanceCard node="node1"/>
            </MemoryRouter>
        );

        expect(screen.queryByLabelText(/View instance details for node1/i)).not.toBeInTheDocument();
    });

    test('handles null node prop gracefully', () => {
        render(
            <MemoryRouter>
                <InstanceCard node={null}/>
            </MemoryRouter>
        );
        expect(mockLogger.error).toHaveBeenCalledWith('Node name is required');
    });

    test('disables actions button when actionInProgress is true', () => {
        render(
            <MemoryRouter>
                <InstanceCard node="node1" actionInProgress={true}/>
            </MemoryRouter>
        );
        const actionsButton = screen.getByLabelText(/Node node1 actions/i);
        expect(actionsButton).toBeDisabled();
    });

    test('uses resolved instance name for logs button', async () => {
        const onOpenLogs = vi.fn();
        const nodeData = {instanceName: 'custom-instance'};
        render(
            <MemoryRouter>
                <InstanceCard node="node1" nodeData={nodeData} onOpenLogs={onOpenLogs}/>
            </MemoryRouter>
        );
        const logsButton = screen.getByLabelText(/View logs for instance custom-instance/i);
        await user.click(logsButton);
        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'custom-instance');
    });

    test('uses node name as instance name when not provided', async () => {
        const onOpenLogs = vi.fn();
        render(
            <MemoryRouter>
                <InstanceCard node="node1" onOpenLogs={onOpenLogs}/>
            </MemoryRouter>
        );

        const logsButton = screen.getByLabelText(/View logs for instance node1/i);
        await user.click(logsButton);

        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'node1');
    });

    // ─── stopped indicator ──────────────────────────────────────────────
    describe('stopped indicator', () => {
        test('shows the stopped icon when isStopped is true', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'unfrozen',
                state: null,
                isStopped: true,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('StopIcon')).toBeInTheDocument();
        });

        test('does not show the stopped icon when isStopped is false', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'unfrozen',
                state: null,
                isStopped: false,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.queryByTestId('StopIcon')).not.toBeInTheDocument();
        });

        test('does not show the stopped icon by default (getNodeState without the flag)', () => {
            const getNodeState = vi.fn(() => ({avail: 'up', frozen: 'unfrozen', state: null}));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.queryByTestId('StopIcon')).not.toBeInTheDocument();
        });

        test('stopped tooltip contains the stopped_at date when provided', () => {
            const nodeData = {stopped_at: '2025-05-16T10:00:00Z'};
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'unfrozen',
                state: null,
                isStopped: true,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" nodeData={nodeData} getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            const title = tooltipTitleFor('StopIcon');
            expect(title).toEqual(expect.stringContaining('stopped at'));
        });

        test('stopped tooltip is just "stopped" when no stopped_at is provided', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'unfrozen',
                state: null,
                isStopped: true,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(tooltipTitleFor('StopIcon')).toBe('stopped');
        });
    });

    // ─── RPO-breached indicator ─────────────────────────────────────────
    describe('RPO-breached indicator', () => {
        test('shows the sync-problem icon when isLagging is true', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'unfrozen',
                state: null,
                isStopped: false,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('SyncProblemIcon')).toBeInTheDocument();
        });

        test('does not show the sync-problem icon when isLagging is false', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'unfrozen',
                state: null,
                isStopped: false,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.queryByTestId('SyncProblemIcon')).not.toBeInTheDocument();
        });

        test('does not show the sync-problem icon by default (getNodeState without the flag)', () => {
            const getNodeState = vi.fn(() => ({avail: 'up', frozen: 'unfrozen', state: null}));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.queryByTestId('SyncProblemIcon')).not.toBeInTheDocument();
        });

        test('lagging tooltip is "RPO breached" and does NOT contain a date', () => {
            const nodeData = {rpo_breached_at: '2025-05-16T10:00:00Z'};
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'unfrozen',
                state: null,
                isStopped: false,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" nodeData={nodeData} getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            const title = tooltipTitleFor('SyncProblemIcon');
            expect(title).toBe('RPO breached');
            expect(title).not.toEqual(expect.stringContaining('2025'));
        });
    });

    // ─── precedence and coexistence ─────────────────────────────────────
    describe('indicator precedence and coexistence', () => {
        test('RPO-breached takes precedence over frozen', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'frozen',
                state: null,
                isStopped: false,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('SyncProblemIcon')).toBeInTheDocument();
            expect(screen.queryByTestId('AcUnitIcon')).not.toBeInTheDocument();
        });

        test('frozen is shown when isLagging is false', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'frozen',
                state: null,
                isStopped: false,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
            expect(screen.queryByTestId('SyncProblemIcon')).not.toBeInTheDocument();
        });

        test('stopped and RPO-breached are shown simultaneously', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'unfrozen',
                state: null,
                isStopped: true,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('StopIcon')).toBeInTheDocument();
            expect(screen.getByTestId('SyncProblemIcon')).toBeInTheDocument();
        });

        test('stopped + RPO-breached + frozen: frozen is hidden by lagging precedence', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'frozen',
                state: null,
                isStopped: true,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('StopIcon')).toBeInTheDocument();
            expect(screen.getByTestId('SyncProblemIcon')).toBeInTheDocument();
            expect(screen.queryByTestId('AcUnitIcon')).not.toBeInTheDocument();
        });

        test('healthy node shows none of the special indicators', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'up',
                frozen: 'unfrozen',
                state: null,
                isStopped: false,
                isLagging: false,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.queryByTestId('StopIcon')).not.toBeInTheDocument();
            expect(screen.queryByTestId('SyncProblemIcon')).not.toBeInTheDocument();
            expect(screen.queryByTestId('AcUnitIcon')).not.toBeInTheDocument();
        });

        test('availability dot remains visible alongside stopped and lagging', () => {
            const getNodeState = vi.fn(() => ({
                avail: 'down',
                frozen: 'unfrozen',
                state: null,
                isStopped: true,
                isLagging: true,
            }));
            render(
                <MemoryRouter>
                    <InstanceCard node="node1" getNodeState={getNodeState}/>
                </MemoryRouter>
            );
            expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
            expect(screen.getByTestId('StopIcon')).toBeInTheDocument();
            expect(screen.getByTestId('SyncProblemIcon')).toBeInTheDocument();
        });
    });
});
