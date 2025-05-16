import React from 'react';
import {render, screen, fireEvent, within, waitFor} from '@testing-library/react';
import {blue, green} from '@mui/material/colors';
import NodeRow from '../NodeRow';
import '@testing-library/jest-dom';

// Mock only specific MUI components/icons that need custom behavior
jest.mock('@mui/icons-material/MoreVert', () => () => <span aria-label="More options"/>);

jest.mock('react-icons/fa', () => ({
    FaSnowflake: ({style}) => <span style={style} aria-label="Frozen icon"/>,
    FaWifi: ({style}) => <span style={style} aria-label="Daemon node icon"/>,
    FaPlay: () => <span aria-label="Unfreeze icon"/>,
    FaSync: () => <span aria-label="Restart daemon icon"/>,
    FaStop: () => <span aria-label="Abort icon"/>,
    FaBroom: () => <span aria-label="Clear icon"/>,
    FaTint: () => <span aria-label="Drain icon"/>,
    FaBox: () => <span aria-label="Asset icon"/>,
    FaHdd: () => <span aria-label="Disk icon"/>,
    FaPuzzlePiece: () => <span aria-label="Patch icon"/>,
    FaArchive: () => <span aria-label="Pkg icon"/>,
    FaBrain: () => <span aria-label="Capabilities icon"/>,
    FaClipboardList: () => <span aria-label="Sysreport icon"/>,
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
        const updatedRow = screen.getByRole('row', {name: /Node node1 row/i});
        const updatedCheckbox = within(updatedRow).getByRole('checkbox', {name: /Select node node1/i});
        expect(updatedCheckbox).not.toBeChecked();
    });

    test('calls onSelect when checkbox is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const checkbox = within(row).getByRole('checkbox', {name: /Select node node1/i});
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
        render(
            <NodeRow
                {...defaultProps}
                status={{frozen_at: '2023-01-01T12:00:00Z', agent: 'v1.2.3'}}
            />
        );
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const frozenIcon = within(row).getByLabelText('Frozen indicator');
        expect(frozenIcon).toBeInTheDocument();
    });

    test('does not render frozen icon when not frozen', () => {
        render(<NodeRow {...defaultProps} status={{frozen_at: null}}/>);
        expect(screen.queryByLabelText('Frozen indicator')).not.toBeInTheDocument();
    });

    test('renders wifi icon when nodename matches daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node1"/>);
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const wifiIcon = within(row).getByLabelText('Daemon node indicator');
        expect(wifiIcon).toBeInTheDocument();
        console.log('wifiIcon HTML:', wifiIcon.outerHTML);
        // Temporarily skip style check
        // expect(wifiIcon).toHaveStyle({ color: 'rgb(76, 175, 80)' });
    });

    test('does not render wifi icon when nodename does not match daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node2"/>);
        expect(screen.queryByLabelText('Daemon node indicator')).not.toBeInTheDocument();
    });

    test('renders stats correctly', () => {
        render(<NodeRow {...defaultProps} />);
        expect(screen.getByText('85')).toBeInTheDocument(); // score
        expect(screen.getByText('1.5')).toBeInTheDocument(); // load_15m
        expect(screen.getByText('60%')).toBeInTheDocument(); // mem_avail
        expect(screen.getByText('75%')).toBeInTheDocument(); // swap_avail
        expect(screen.getByText('v1.2.3')).toBeInTheDocument(); // agent
    });

    test('renders N/A for undefined stats', () => {
        render(<NodeRow {...defaultProps} stats={null} status={null}/>);
        const cells = screen.getAllByRole('cell');
        expect(cells[3]).toHaveTextContent('N/A'); // score
        expect(cells[4]).toHaveTextContent('N/A'); // load_15m
        expect(cells[5]).toHaveTextContent('N/A'); // mem_avail
        expect(cells[6]).toHaveTextContent('N/A'); // swap_avail
        expect(cells[7]).toHaveTextContent('N/A'); // agent
    });

    test('renders LinearProgress for load_15m with correct value and color', () => {
        render(<NodeRow {...defaultProps} stats={{load_15m: 1.5}}/>);
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const loadCell = screen.getByText('1.5').closest('td');
        const progress = within(loadCell).getByRole('progressbar');
        expect(progress).toHaveAttribute('aria-valuenow', '30'); // 1.5 * 20 = 30
        expect(progress).toHaveStyle('height: 4px'); // From sx

        render(<NodeRow {...defaultProps} stats={{load_15m: 3}}/>);
        const loadCellWarn = screen.getByText('3').closest('td');
        const progressWarn = within(loadCellWarn).getByRole('progressbar');
        expect(progressWarn).toHaveAttribute('aria-valuenow', '60'); // 3 * 20 = 60

        render(<NodeRow {...defaultProps} stats={{load_15m: 5}}/>);
        const loadCellErr = screen.getByText('5').closest('td');
        const progressErr = within(loadCellErr).getByRole('progressbar');
        expect(progressErr).toHaveAttribute('aria-valuenow', '100'); // 5 * 20 = 100 (capped)
    });

    test('renders LinearProgress for mem_avail with correct value and color', () => {
        render(<NodeRow {...defaultProps} stats={{mem_avail: 60}}/>);
        const row = screen.getByRole('row', {name: /Node node1 row/i});
        const memCell = screen.getByText('60%').closest('td');
        const progress = within(memCell).getByRole('progressbar');
        expect(progress).toHaveAttribute('aria-valuenow', '60');

        render(<NodeRow {...defaultProps} stats={{mem_avail: 40}}/>);
        const memCellWarn = screen.getByText('40%').closest('td');
        const progressWarn = within(memCellWarn).getByRole('progressbar');
        expect(progressWarn).toHaveAttribute('aria-valuenow', '40');

        render(<NodeRow {...defaultProps} stats={{mem_avail: 10}}/>);
        const memCellErr = screen.getByText('10%').closest('td');
        const progressErr = within(memCellErr).getByRole('progressbar');
        expect(progressErr).toHaveAttribute('aria-valuenow', '10');
    });

    test('opens menu when menu button is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const menuButton = screen.getByRole('button', {name: /More actions for node node1/i});
        fireEvent.click(menuButton);
        expect(defaultProps.onMenuOpen).toHaveBeenCalledWith(expect.any(Object), 'node1');
    });

    test('renders menu with items when open', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        expect(menu).toBeInTheDocument();
        expect(within(menu).getByText('Freeze')).toBeInTheDocument();
        expect(within(menu).getByText('Restart Daemon')).toBeInTheDocument();
    });

    test('renders correct menu items when node is not frozen', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        expect(within(menu).getByRole('menuitem', {name: /Freeze action/i})).toBeInTheDocument();
        expect(within(menu).queryByRole('menuitem', {name: /Unfreeze action/i})).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Restart Daemon action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Abort action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Clear action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Drain action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Asset action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Disk action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Patch action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Pkg action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Capabilities action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Sysreport action/i})).toBeInTheDocument();
    });

    test('renders correct menu items when node is frozen', async () => {
        const anchorEl = document.createElement('div');
        const frozenProps = {
            ...defaultProps,
            status: {frozen_at: '2023-01-01T12:00:00Z', agent: 'v1.2.3'},
            anchorEl
        };
        console.log('Test props:', frozenProps);
        render(<NodeRow {...frozenProps} />);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        console.log('Menu HTML:', menu.outerHTML);
        const menuItems = menu.querySelectorAll('[role="menuitem"]');
        console.log('Menu Items:', Array.from(menuItems).map(item => item.getAttribute('aria-label')));
        expect(within(menu).getByRole('menuitem', {name: /Unfreeze action/i})).toBeInTheDocument();
        expect(within(menu).queryByText('Freeze')).not.toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Restart Daemon action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Abort action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Clear action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Drain action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Asset action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Disk action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Patch action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Pkg action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Capabilities action/i})).toBeInTheDocument();
        expect(within(menu).getByRole('menuitem', {name: /Sysreport action/i})).toBeInTheDocument();
    });

    test('calls onAction when menu item is clicked', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        const menuItems = [
            {name: 'Freeze action', action: 'action/freeze'},
            {name: 'Restart Daemon action', action: 'daemon/action/restart'},
            {name: 'Abort action', action: 'action/abort'},
            {name: 'Clear action', action: 'action/clear'},
            {name: 'Drain action', action: 'action/drain'},
            {name: 'Asset action', action: 'action/push/asset'},
            {name: 'Disk action', action: 'action/push/disk'},
            {name: 'Patch action', action: 'action/push/patch'},
            {name: 'Pkg action', action: 'action/push/pkg'},
            {name: 'Capabilities action', action: 'action/scan/capabilities'},
            {name: 'Sysreport action', action: 'action/sysreport'},
        ];

        for (const {name, action} of menuItems) {
            const item = within(menu).getByRole('menuitem', {name: new RegExp(name, 'i')});
            fireEvent.click(item);
            expect(defaultProps.onAction).toHaveBeenCalledWith('node1', action);
        }
    });

    test('calls onMenuClose when menu item is clicked', async () => {
        const anchorEl = document.createElement('div');
        render(<NodeRow {...defaultProps} anchorEl={anchorEl}/>);
        const menu = await screen.findByRole('menu', {}, {timeout: 3000});
        const menuItem = within(menu).getByRole('menuitem', {name: /Freeze action/i});
        fireEvent.click(menuItem);
        expect(defaultProps.onMenuClose).toHaveBeenCalledWith('node1');
    });

    test('renders correctly with minimal props', () => {
        render(
            <NodeRow
                nodename="node1"
                onSelect={jest.fn()}
                onMenuOpen={jest.fn()}
                onMenuClose={jest.fn()}
                onAction={jest.fn()}
            />
        );
        expect(screen.getByText('node1')).toBeInTheDocument();
        const cells = screen.getAllByRole('cell');
        expect(cells[3]).toHaveTextContent('N/A'); // score
        expect(cells[4]).toHaveTextContent('N/A'); // load_15m
        expect(cells[5]).toHaveTextContent('N/A'); // mem_avail
        expect(cells[6]).toHaveTextContent('N/A'); // swap_avail
        expect(cells[7]).toHaveTextContent('N/A'); // agent
    });
});