import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import NodeCard from '../NodeCard';
import userEvent from '@testing-library/user-event';
import {grey} from '@mui/material/colors';
import logger from '../../utils/logger.js';

// Mock implementations
jest.mock('../../utils/logger.js', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));

jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
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
            <button
                onClick={onClick}
                disabled={disabled}
                aria-label={props['aria-label']}
                {...props}
            >
                {children}
            </button>
        ),
        Box: ({children, onClick, onMouseEnter, onMouseLeave, ...props}) => (
            <div
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                {...props}
            >
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

jest.mock('@mui/icons-material/AcUnit', () => () => <span data-testid="AcUnitIcon"/>);
jest.mock('@mui/icons-material/MoreVert', () => () => <span data-testid="MoreVertIcon"/>);
jest.mock('@mui/icons-material/Article', () => () => <span data-testid="ArticleIcon"/>);
jest.mock('@mui/icons-material/PriorityHigh', () => () => <span data-testid="PriorityHighIcon"/>);

describe('NodeCard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders node name correctly', () => {
        render(
            <MemoryRouter>
                <NodeCard node="node1"/>
            </MemoryRouter>
        );

        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('renders node with provided nodeData', () => {
        const nodeData = {
            instanceName: 'instance1',
            provisioned: true,
        };

        render(
            <MemoryRouter>
                <NodeCard node="node1" nodeData={nodeData}/>
            </MemoryRouter>
        );

        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('calls toggleNode when checkbox is clicked', async () => {
        const toggleNode = jest.fn();

        render(
            <MemoryRouter>
                <NodeCard node="node1" toggleNode={toggleNode}/>
            </MemoryRouter>
        );

        const checkbox = screen.getByLabelText(/select node node1/i);
        await user.click(checkbox);

        expect(toggleNode).toHaveBeenCalledWith('node1');
    });

    test('calls onOpenLogs when logs button is clicked', async () => {
        const onOpenLogs = jest.fn();
        const nodeData = {instanceName: 'instance1'};

        render(
            <MemoryRouter>
                <NodeCard node="node1" nodeData={nodeData} onOpenLogs={onOpenLogs}/>
            </MemoryRouter>
        );

        const logsButton = screen.getByLabelText(/View logs for instance instance1/i);
        await user.click(logsButton);

        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'instance1');
    });

    test('calls onViewInstance when card is clicked (except on interactive elements)', async () => {
        const onViewInstance = jest.fn();

        render(
            <MemoryRouter>
                <NodeCard node="node1" onViewInstance={onViewInstance}/>
            </MemoryRouter>
        );

        // Click on the node name text (not on interactive elements)
        await user.click(screen.getByText('node1'));

        expect(onViewInstance).toHaveBeenCalledWith('node1');
    });

    test('does not call onViewInstance when interactive elements are clicked', async () => {
        const onViewInstance = jest.fn();

        render(
            <MemoryRouter>
                <NodeCard node="node1" onViewInstance={onViewInstance}/>
            </MemoryRouter>
        );

        // Click on checkbox (should not trigger onViewInstance)
        const checkbox = screen.getByLabelText(/select node node1/i);
        await user.click(checkbox);

        // Click on logs button (should not trigger onViewInstance)
        const logsButton = screen.getByLabelText(/View logs for instance node1/i);
        await user.click(logsButton);

        // Click on actions button (should not trigger onViewInstance)
        const actionsButton = screen.getByLabelText(/Node node1 actions/i);
        await user.click(actionsButton);

        expect(onViewInstance).not.toHaveBeenCalled();
    });

    test('opens node actions menu when actions button is clicked', async () => {
        const setCurrentNode = jest.fn();
        const setIndividualNodeMenuAnchor = jest.fn();

        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    setCurrentNode={setCurrentNode}
                    setIndividualNodeMenuAnchor={setIndividualNodeMenuAnchor}
                />
            </MemoryRouter>
        );

        const actionsButton = screen.getByLabelText(/Node node1 actions/i);
        fireEvent.click(actionsButton);

        expect(setCurrentNode).toHaveBeenCalledWith('node1');
        expect(setIndividualNodeMenuAnchor).toHaveBeenCalled();
    });

    test('displays node status using getColor function', () => {
        const getColor = jest.fn(() => grey[500]);
        const getNodeState = jest.fn(() => ({avail: 'up', frozen: 'unfrozen', state: null}));

        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    getColor={getColor}
                    getNodeState={getNodeState}
                />
            </MemoryRouter>
        );

        expect(getColor).toHaveBeenCalledWith('up');
        expect(getNodeState).toHaveBeenCalledWith('node1');
    });

    test('shows frozen icon when node is frozen', () => {
        const getNodeState = jest.fn(() => ({avail: 'up', frozen: 'frozen', state: null}));

        render(
            <MemoryRouter>
                <NodeCard node="node1" getNodeState={getNodeState}/>
            </MemoryRouter>
        );

        expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
    });

    test('shows not provisioned icon when instance is not provisioned', () => {
        const nodeData = {provisioned: false};
        const parseProvisionedState = jest.fn(() => false);

        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    nodeData={nodeData}
                    parseProvisionedState={parseProvisionedState}
                />
            </MemoryRouter>
        );

        expect(screen.getByTestId('PriorityHighIcon')).toBeInTheDocument();
        expect(parseProvisionedState).toHaveBeenCalledWith(false);
    });

    test('displays node state when available', () => {
        const getNodeState = jest.fn(() => ({avail: 'up', frozen: 'unfrozen', state: 'running'}));

        render(
            <MemoryRouter>
                <NodeCard node="node1" getNodeState={getNodeState}/>
            </MemoryRouter>
        );

        expect(screen.getByText('running')).toBeInTheDocument();
    });

    test('handles default functions gracefully', () => {
        render(
            <MemoryRouter>
                <NodeCard node="node1"/>
            </MemoryRouter>
        );

        // Click checkbox to trigger default toggleNode
        const checkbox = screen.getByLabelText(/select node node1/i);
        fireEvent.click(checkbox);
        expect(logger.warn).toHaveBeenCalledWith("toggleNode not provided");

        // Click logs button to trigger default onOpenLogs
        const logsButton = screen.getByLabelText(/View logs for instance node1/i);
        fireEvent.click(logsButton);
        expect(logger.warn).toHaveBeenCalledWith("onOpenLogs not provided");
    });

    test('does not show view instance button when onViewInstance is not provided', () => {
        render(
            <MemoryRouter>
                <NodeCard node="node1"/>
            </MemoryRouter>
        );

        // Since we removed the "View instance details" button, this test should pass
        // because there is no button to find
        expect(screen.queryByLabelText(/View instance details for node1/i)).not.toBeInTheDocument();
    });

    test('handles null node prop gracefully', () => {
        render(
            <MemoryRouter>
                <NodeCard node={null}/>
            </MemoryRouter>
        );

        expect(logger.error).toHaveBeenCalledWith("Node name is required");
    });

    test('disables actions button when actionInProgress is true', () => {
        render(
            <MemoryRouter>
                <NodeCard node="node1" actionInProgress={true}/>
            </MemoryRouter>
        );

        const actionsButton = screen.getByLabelText(/Node node1 actions/i);
        expect(actionsButton).toBeDisabled();
    });

    test('uses resolved instance name for logs button', async () => {
        const onOpenLogs = jest.fn();
        const nodeData = {instanceName: 'custom-instance'};

        render(
            <MemoryRouter>
                <NodeCard
                    node="node1"
                    nodeData={nodeData}
                    onOpenLogs={onOpenLogs}
                />
            </MemoryRouter>
        );

        const logsButton = screen.getByLabelText(/View logs for instance custom-instance/i);
        await user.click(logsButton);

        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'custom-instance');
    });

    test('uses node name as instance name when not provided', async () => {
        const onOpenLogs = jest.fn();

        render(
            <MemoryRouter>
                <NodeCard node="node1" onOpenLogs={onOpenLogs}/>
            </MemoryRouter>
        );

        const logsButton = screen.getByLabelText(/View logs for instance node1/i);
        await user.click(logsButton);

        expect(onOpenLogs).toHaveBeenCalledWith('node1', 'node1');
    });
});
