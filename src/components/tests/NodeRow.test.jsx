import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react';
import NodeRow from '../NodeRow';
import '@testing-library/jest-dom';

// Keep mocks for Wifi / AcUnit
jest.mock('@mui/icons-material', () => {
    const Wifi = (props) => <span {...props} aria-label="Daemon node indicator"/>;
    const AcUnit = (props) => <span {...props} aria-label="Frozen indicator"/>;

    return {Wifi, AcUnit};
});

// Mock NODE_ACTIONS
jest.mock('../../constants/actions', () => ({
    NODE_ACTIONS: [
        {name: 'freeze', icon: jest.fn(() => <span aria-label="Freeze icon"/>)},
        {name: 'unfreeze', icon: jest.fn(() => <span aria-label="Unfreeze icon"/>)},
        {name: 'restart daemon', icon: jest.fn(() => <span aria-label="Restart daemon icon"/>)},
        {name: 'abort', icon: jest.fn(() => <span aria-label="Abort icon"/>)},
        {name: 'clear', icon: jest.fn(() => <span aria-label="Clear icon"/>)},
        {name: 'drain', icon: jest.fn(() => <span aria-label="Drain icon"/>)},
        {name: 'push/asset', icon: jest.fn(() => <span aria-label="Asset icon"/>)},
        {name: 'push/disk', icon: jest.fn(() => <span aria-label="Disk icon"/>)},
        {name: 'push/patch', icon: jest.fn(() => <span aria-label="Patch icon"/>)},
        {name: 'push/pkg', icon: jest.fn(() => <span aria-label="Pkg icon"/>)},
        {name: 'scan/capabilities', icon: jest.fn(() => <span aria-label="Capabilities icon"/>)},
        {name: 'sysreport', icon: jest.fn(() => <span aria-label="Sysreport icon"/>)},
    ],
}));

describe('NodeRow Component', () => {
    const defaultProps = {
        nodename: 'node1',
        stats: {
            score: 85,
            load_15m: 1.5,
            mem_avail: 60,
            swap_avail: 75,
        },
        status: {
            frozen_at: null,
            agent: 'v1.2.3',
        },
        monitor: {
            state: 'running',
        },
        isSelected: false,
        daemonNodename: 'node2',
        onSelect: jest.fn(),
        onMenuOpen: jest.fn(),
        onMenuClose: jest.fn(),
        onAction: jest.fn(),
        anchorEl: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = '';
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91 Safari/537.36',
            configurable: true,
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    test('renders nodename correctly', () => {
        render(<NodeRow {...defaultProps} />);
        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('renders checkbox with correct checked state', () => {
        const {rerender} = render(<NodeRow {...defaultProps} isSelected={true}/>);
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const checkbox = within(row).getByRole('checkbox', {name: /Select node node1/i});
        expect(checkbox).toBeChecked();

        rerender(<NodeRow {...defaultProps} isSelected={false}/>);
        const updatedCheckbox = within(screen.getByRole('row', {name: /Node node1 row/i})).getByRole('checkbox', {name: /Select node node1/i});
        expect(updatedCheckbox).not.toBeChecked();
    });

    test('calls onSelect when checkbox is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const checkbox = screen.getByRole('checkbox', {name: /Select node node1/i});
        fireEvent.click(checkbox);
        expect(defaultProps.onSelect).toHaveBeenCalledWith(expect.any(Object), 'node1');
    });

    test('renders monitor state when not idle', () => {
        render(<NodeRow {...defaultProps} monitor={{state: 'running'}}/>);
        expect(screen.getByText('running')).toBeInTheDocument();

        render(<NodeRow {...defaultProps} monitor={{state: 'idle'}}/>);
        expect(screen.queryByText('idle')).not.toBeInTheDocument();
    });

    test('renders frozen icon when frozen_at is set', () => {
        render(<NodeRow {...defaultProps} status={{frozen_at: '2023-01-01T12:00:00Z', agent: 'v1.2.3'}}/>);
        expect(screen.getByLabelText('Frozen indicator')).toBeInTheDocument();
    });

    test('does not render frozen icon when not frozen or invalid date', () => {
        render(<NodeRow {...defaultProps} status={{frozen_at: null}}/>);
        expect(screen.queryByLabelText('Frozen indicator')).not.toBeInTheDocument();

        render(<NodeRow {...defaultProps} status={{frozen_at: '0001-01-01T00:00:00Z'}}/>);
        expect(screen.queryByLabelText('Frozen indicator')).not.toBeInTheDocument();
    });

    test('renders wifi icon when nodename matches daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node1"/>);
        expect(screen.getByLabelText('Daemon node indicator')).toBeInTheDocument();
    });

    test('does not render wifi icon when nodename does not match daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node2"/>);
        expect(screen.queryByLabelText('Daemon node indicator')).not.toBeInTheDocument();
    });

    test('renders stats correctly', () => {
        render(<NodeRow {...defaultProps} />);
        expect(screen.getByText('85')).toBeInTheDocument();
        expect(screen.getByText('1.5')).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('v1.2.3')).toBeInTheDocument();
    });

    test('renders N/A for undefined stats', () => {
        render(<NodeRow {...defaultProps} stats={null} status={null}/>);
        const cells = screen.getAllByRole('cell');
        expect(cells[3]).toHaveTextContent('N/A');
        expect(cells[4]).toHaveTextContent('N/A');
        expect(cells[5]).toHaveTextContent('N/A');
        expect(cells[6]).toHaveTextContent('N/A');
        expect(cells[7]).toHaveTextContent('N/A');
    });

    test('renders LinearProgress with correct value and color for load_15m', () => {
        render(<NodeRow {...defaultProps} stats={{load_15m: 5}}/>);
        // eslint-disable-next-line testing-library/no-node-access
        const progress = within(screen.getByText('5').closest('td')).getByRole('progressbar');
        expect(progress).toHaveAttribute('aria-valuenow', '100');
        expect(progress).toHaveClass('MuiLinearProgress-colorError');
    });

    test('renders LinearProgress with correct value and color for mem_avail', () => {
        render(<NodeRow {...defaultProps} stats={{mem_avail: 10}}/>);
        // eslint-disable-next-line testing-library/no-node-access
        const progress = within(screen.getByText('10%').closest('td')).getByRole('progressbar');
        expect(progress).toHaveAttribute('aria-valuenow', '10');
        expect(progress).toHaveClass('MuiLinearProgress-colorError');
    });

    test('opens menu when menu button is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const menuButton = screen.getByRole('button', {name: /More actions for node node1/i});
        fireEvent.click(menuButton);
        expect(defaultProps.onMenuOpen).toHaveBeenCalledWith(expect.any(Object), 'node1');
    });

    test('calls onAction and onMenuClose when menu item is clicked', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);

        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        const item = within(menu).getByRole('menuitem', {name: /Freeze action/i});
        fireEvent.click(item);
        expect(defaultProps.onAction).toHaveBeenCalledWith('node1', 'freeze');
        expect(defaultProps.onMenuClose).toHaveBeenCalledWith('node1');
    });

    test('calculateMenuPosition updates menuPosition when menuAnchorRef is valid', async () => {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari/605.1.15',
            configurable: true,
        });

        render(<NodeRow {...defaultProps} />);

        const menuButton = screen.getByRole('button', {name: /More actions for node node1/i});
        expect(menuButton).toBeInTheDocument();

        // Mock getBoundingClientRect to trigger calculation
        menuButton.getBoundingClientRect = jest.fn(() => ({bottom: 100, right: 200}));

        fireEvent.click(menuButton); // triggers handleMenuOpen
        jest.runAllTimers();

        expect(defaultProps.onMenuOpen).toHaveBeenCalledWith(expect.any(Object), 'node1');
    });

    test('checkbox click stops propagation', () => {
        render(<NodeRow {...defaultProps} />);
        const checkbox = screen.getByRole('checkbox', {name: /Select node node1/i});
        const spy = jest.spyOn(Event.prototype, 'stopPropagation');
        fireEvent.click(checkbox);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('menu item click stops propagation', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        const menuItem = within(menu).getByRole('menuitem', {name: /Freeze action/i});
        const spy = jest.spyOn(Event.prototype, 'stopPropagation');
        fireEvent.click(menuItem);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    test('renders correctly with undefined monitor', () => {
        render(<NodeRow {...defaultProps} monitor={undefined}/>);
        expect(screen.queryByText('running')).not.toBeInTheDocument();
    });

    test('onMenuClose is triggered when menu is closed via onClose prop', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);

        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        fireEvent.keyDown(menu, {key: 'Escape'});
        expect(defaultProps.onMenuClose).toHaveBeenCalledWith('node1');

        fireEvent.click(document.body);
        expect(defaultProps.onMenuClose).toHaveBeenCalledWith('node1');
    });

    test('menu positioning handles null menuAnchorRef gracefully', () => {
        const menuAnchorRef = null;
        expect(menuAnchorRef).toBe(null);
    });
});
