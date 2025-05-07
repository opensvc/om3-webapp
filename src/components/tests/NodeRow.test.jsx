import React from 'react';
import {render, screen, fireEvent, within, cleanup, waitFor} from '@testing-library/react';
import {blue, green} from '@mui/material/colors';
import NodeRow from '../NodeRow';

// Mock dependencies
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Box: ({children, sx, ...props}) => <div style={sx} {...props}>{children}</div>,
    Checkbox: ({checked, onChange, ...props}) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            data-testid="select-checkbox"
            {...props}
        />
    ),
    TableCell: ({children, ...props}) => <td {...props}>{children}</td>,
    TableRow: ({children, ...props}) => <tr data-testid="node-row" {...props}>{children}</tr>,
    Tooltip: ({title, children}) => (
        <div data-testid={`tooltip-${title.toLowerCase().replace(/\s/g, '-')}`}>
            {children}
        </div>
    ),
    IconButton: ({children, onClick, ...props}) => (
        <button onClick={onClick} data-testid="menu-button" {...props}>
            {children}
        </button>
    ),
    LinearProgress: ({value, color, sx, ...props}) => (
        <div
            data-testid={`linear-progress-${color}`}
            style={{width: `${value}%`, ...sx}}
            {...props}
        />
    ),
    Menu: ({anchorEl, open, onClose, children}) =>
        open ? (
            <div data-testid="menu">
                {children}
            </div>
        ) : null,
    MenuItem: ({onClick, children, sx, 'data-testid': testId, ...props}) => (
        <div
            onClick={onClick}
            data-testid={testId}
            style={sx}
            {...props}
        >
            {children}
        </div>
    ),
}));

jest.mock('react-icons/fa', () => ({
    FaSnowflake: ({style}) => <span data-testid="snowflake-icon" style={style}/>,
    FaWifi: ({style}) => <span data-testid="wifi-icon" style={style}/>,
    FaPlay: () => <span data-testid="play-icon"/>,
    FaSync: () => <span data-testid="sync-icon"/>,
    FaStop: () => <span data-testid="stop-icon"/>,
    FaBroom: () => <span data-testid="broom-icon"/>,
    FaTint: () => <span data-testid="tint-icon"/>,
    FaBox: () => <span data-testid="box-icon"/>,
    FaHdd: () => <span data-testid="hdd-icon"/>,
    FaPuzzlePiece: () => <span data-testid="puzzle-piece-icon"/>,
    FaArchive: () => <span data-testid="archive-icon"/>,
    FaBrain: () => <span data-testid="brain-icon"/>,
    FaClipboardList: () => <span data-testid="clipboard-list-icon"/>,
}));

jest.mock('@mui/icons-material/MoreVert', () => () => (
    <span data-testid="more-vert-icon"/>
));

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
    });

    afterEach(() => {
        cleanup();
    });

    test('renders nodename correctly', () => {
        render(<NodeRow {...defaultProps} />);
        expect(screen.getByText('node1')).toBeInTheDocument();
    });

    test('renders checkbox with correct checked state', () => {
        const {rerender} = render(<NodeRow {...defaultProps} isSelected={true}/>);
        const row = screen.getByTestId('node-row');
        const checkbox = within(row).getByTestId('select-checkbox');
        expect(checkbox).toBeChecked();

        rerender(<NodeRow {...defaultProps} isSelected={false}/>);
        const row2 = screen.getByTestId('node-row');
        const checkbox2 = within(row2).getByTestId('select-checkbox');
        expect(checkbox2).not.toBeChecked();
    });

    test('calls onSelect when checkbox is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const checkbox = screen.getByTestId('select-checkbox');
        fireEvent.click(checkbox);
        expect(defaultProps.onSelect).toHaveBeenCalledWith(
            expect.any(Object),
            'node1'
        );
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
        const snowflakeIcon = screen.getByTestId('snowflake-icon');
        expect(snowflakeIcon).toBeInTheDocument();
        const tooltip = screen.getByTestId('tooltip-frozen');
        expect(tooltip).toBeInTheDocument();
        expect(snowflakeIcon).toHaveStyle({color: blue[200]});
    });

    test('does not render frozen icon when not frozen', () => {
        render(<NodeRow {...defaultProps} status={{frozen_at: null}}/>);
        expect(screen.queryByTestId('snowflake-icon')).not.toBeInTheDocument();
    });

    test('renders wifi icon when nodename matches daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node1"/>);
        const wifiIcon = screen.getByTestId('wifi-icon');
        expect(wifiIcon).toBeInTheDocument();
        const tooltip = screen.getByTestId('tooltip-daemon-node');
        expect(tooltip).toBeInTheDocument();
        expect(wifiIcon).toHaveStyle({color: green[500]});
    });

    test('does not render wifi icon when nodename does not match daemonNodename', () => {
        render(<NodeRow {...defaultProps} daemonNodename="node2"/>);
        expect(screen.queryByTestId('wifi-icon')).not.toBeInTheDocument();
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
        const progress = screen.getByTestId('linear-progress-success');
        expect(progress).toHaveStyle('width: 30%'); // 1.5 * 20 = 30

        render(<NodeRow {...defaultProps} stats={{load_15m: 3}}/>);
        expect(screen.getByTestId('linear-progress-warning')).toHaveStyle('width: 60%'); // 3 * 20 = 60

        render(<NodeRow {...defaultProps} stats={{load_15m: 5}}/>);
        expect(screen.getByTestId('linear-progress-error')).toHaveStyle('width: 100%'); // 5 * 20 = 100 (capped)
    });

    test('renders LinearProgress for mem_avail with correct value and color', () => {
        render(<NodeRow {...defaultProps} stats={{mem_avail: 60}}/>);
        const progress = screen.getByTestId('linear-progress-success');
        expect(progress).toHaveStyle('width: 60%');

        render(<NodeRow {...defaultProps} stats={{mem_avail: 40}}/>);
        expect(screen.getByTestId('linear-progress-warning')).toHaveStyle('width: 40%');

        render(<NodeRow {...defaultProps} stats={{mem_avail: 10}}/>);
        expect(screen.getByTestId('linear-progress-error')).toHaveStyle('width: 10%');
    });

    test('opens menu when menu button is clicked', () => {
        render(<NodeRow {...defaultProps} />);
        const menuButton = screen.getByTestId('menu-button');
        fireEvent.click(menuButton);
        expect(defaultProps.onMenuOpen).toHaveBeenCalledWith(expect.any(Object), 'node1');
    });

    test('diagnostic: renders menu with items', async () => {
        render(<NodeRow {...defaultProps} anchorEl={document.createElement('div')}/>);
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
        }, {timeout: 2000});
        screen.debug();
        const menuItems = screen.getAllByTestId(/menu-item-/);
        expect(menuItems.length).toBeGreaterThan(0);
        expect(screen.getByTestId('menu-item-freeze')).toBeInTheDocument();
    });

    test('renders correct menu items when node is not frozen', async () => {
        render(<NodeRow {...defaultProps} anchorEl={document.createElement('div')}/>);
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
        }, {timeout: 2000});
        screen.debug();
        expect(screen.getByTestId('menu-item-freeze')).toBeInTheDocument();
        expect(screen.queryByTestId('menu-item-unfreeze')).not.toBeInTheDocument();
        expect(screen.getByTestId('menu-item-restart-daemon')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-abort')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-clear')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-drain')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-asset')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-disk')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-patch')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-pkg')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-capabilities')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-sysreport')).toBeInTheDocument();
    });

    test('renders correct menu items when node is frozen', async () => {
        render(
            <NodeRow
                {...defaultProps}
                status={{frozen_at: '2023-01-01T12:00:00Z', agent: 'v1.2.3'}}
                anchorEl={document.createElement('div')}
            />
        );
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
        }, {timeout: 2000});
        screen.debug();
        expect(screen.queryByTestId('menu-item-freeze')).not.toBeInTheDocument();
        expect(screen.getByTestId('menu-item-unfreeze')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-restart-daemon')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-abort')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-clear')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-drain')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-asset')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-disk')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-patch')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-pkg')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-capabilities')).toBeInTheDocument();
        expect(screen.getByTestId('menu-item-sysreport')).toBeInTheDocument();
    });

    test('calls onAction when menu item is clicked', async () => {
        render(<NodeRow {...defaultProps} anchorEl={document.createElement('div')}/>);
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
        }, {timeout: 2000});
        screen.debug();
        const menuItems = [
            {id: 'menu-item-freeze', action: 'action/freeze'},
            {id: 'menu-item-restart-daemon', action: 'daemon/action/restart'},
            {id: 'menu-item-abort', action: 'action/abort'},
            {id: 'menu-item-clear', action: 'action/clear'},
            {id: 'menu-item-drain', action: 'action/drain'},
            {id: 'menu-item-asset', action: 'action/push/asset'},
            {id: 'menu-item-disk', action: 'action/push/disk'},
            {id: 'menu-item-patch', action: 'action/push/patch'},
            {id: 'menu-item-pkg', action: 'action/push/pkg'},
            {id: 'menu-item-capabilities', action: 'action/scan/capabilities'},
            {id: 'menu-item-sysreport', action: 'action/sysreport'},
        ];

        for (const {id, action} of menuItems) {
            const item = screen.getByTestId(id);
            fireEvent.click(item);
            expect(defaultProps.onAction).toHaveBeenCalledWith('node1', action);
        }
    });

    test('calls onMenuClose when menu is closed', async () => {
        render(<NodeRow {...defaultProps} anchorEl={document.createElement('div')}/>);
        await waitFor(() => {
            expect(screen.getByTestId('menu')).toBeInTheDocument();
        }, {timeout: 2000});
        screen.debug();
        const menuItem = screen.getByTestId('menu-item-freeze');
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