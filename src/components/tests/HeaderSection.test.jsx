import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderSection from '../HeaderSection';
import {isActionAllowedForSelection} from '../../utils/objectUtils';

// Mock constants
jest.mock('../../constants/actions', () => ({
    OBJECT_ACTIONS: [
        {name: 'delete', icon: 'delete-icon'},
        {name: 'edit', icon: 'edit-icon'},
    ],
}));

// Mock Material-UI components
jest.mock('@mui/material', () => {
    const actual = jest.requireActual('@mui/material');
    return {
        ...actual,
        Typography: ({children, ...props}) => <span {...props}>{children}</span>,
        Tooltip: ({children, title}) => <span title={title}>{children}</span>,
        IconButton: ({children, onClick, disabled, ...props}) => (
            <button onClick={onClick} disabled={disabled} {...props}>
                {children}
            </button>
        ),
        Popper: ({children, open, anchorEl, modifiers, ...props}) => {
            if (open) {
                // Simulate calling offset modifier for coverage
                modifiers?.forEach(mod => {
                    if (mod.name === 'offset' && typeof mod.options.offset === 'function') {
                        mod.options.offset();
                    }
                });
                return <div data-testid="popper" {...props}>{children}</div>;
            }
            return null;
        },
        Paper: ({children, ...props}) => <div {...props}>{children}</div>,
        MenuItem: ({children, onClick, disabled, ...props}) => (
            <div role="menuitem" onClick={onClick} data-disabled={disabled} {...props}>
                {children}
            </div>
        ),
        ListItemIcon: ({children, ...props}) => <span {...props}>{children}</span>,
        ListItemText: ({children}) => <span>{children}</span>,
        ClickAwayListener: ({children, onClickAway}) => (
            <div onClick={() => onClickAway()}>{children}</div>
        ),
    };
});

// Mock Material-UI icons
jest.mock('@mui/icons-material/FiberManualRecord', () => () => (
    <svg data-testid="FiberManualRecordIcon"/>
));
jest.mock('@mui/icons-material/PriorityHigh', () => () => (
    <svg data-testid="PriorityHighIcon"/>
));
jest.mock('@mui/icons-material/AcUnit', () => () => <svg data-testid="AcUnitIcon"/>);
jest.mock('@mui/icons-material/MoreVert', () => () => (
    <svg data-testid="MoreVertIcon"/>
));

// Mock objectUtils
jest.mock('../../utils/objectUtils', () => ({
    isActionAllowedForSelection: jest.fn(),
}));

// Mock navigator.userAgent for Safari detection
Object.defineProperty(global.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    writable: true,
});

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(() => 'mock-token'),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'localStorage', {value: mockLocalStorage});

describe('HeaderSection Component', () => {
    const defaultProps = {
        decodedObjectName: 'root/svc/svc1',
        globalStatus: {avail: 'up', frozen: 'frozen', provisioned: 'true'},
        actionInProgress: false,
        objectMenuAnchor: null,
        setObjectMenuAnchor: jest.fn(),
        handleObjectActionClick: jest.fn(),
        getObjectStatus: jest.fn(() => ({
            avail: 'up',
            frozen: 'frozen',
            globalExpect: 'placed@node1',
        })),
        getColor: jest.fn((status) => {
            if (status === 'up') return 'green';
            if (status === 'warn') return 'orange';
            if (status === 'down') return 'red';
            return 'grey';
        }),
        objectMenuAnchorRef: {current: null},
    };

    beforeEach(() => {
        jest.clearAllMocks();
        isActionAllowedForSelection.mockReturnValue(true);
        defaultProps.getObjectStatus.mockReturnValue({
            avail: 'up',
            frozen: 'frozen',
            globalExpect: 'placed@node1',
        });
        defaultProps.getColor.mockImplementation((status) => {
            if (status === 'up') return 'green';
            if (status === 'warn') return 'orange';
            if (status === 'down') return 'red';
            return 'grey';
        });
        global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36';
    });

    test('renders object name and status icons', async () => {
        render(<HeaderSection {...defaultProps} />);

        expect(screen.getByText('root/svc/svc1')).toBeInTheDocument();
        expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
        expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
        expect(screen.getByText('placed@node1')).toBeInTheDocument();
    });

    test('renders warning icon when status is warn', async () => {
        defaultProps.getObjectStatus.mockReturnValue({
            avail: 'warn',
            frozen: 'unfrozen',
            globalExpect: null,
        });

        render(<HeaderSection {...defaultProps} />);

        expect(screen.getByText('root/svc/svc1')).toBeInTheDocument();
        expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
        expect(screen.queryByTestId('AcUnitIcon')).not.toBeInTheDocument();
        expect(screen.queryByText('placed@node1')).not.toBeInTheDocument();
    });

    test('renders not provisioned icon when provisioned is false', async () => {
        const props = {
            ...defaultProps,
            globalStatus: {...defaultProps.globalStatus, provisioned: 'false'},
        };

        render(<HeaderSection {...props} />);

        expect(screen.getByText('root/svc/svc1')).toBeInTheDocument();
        expect(screen.getAllByTestId('PriorityHighIcon')).toHaveLength(1);
        expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
        expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
    });

    test('disables menu button when actionInProgress is true', async () => {
        const props = {
            ...defaultProps,
            actionInProgress: true,
        };

        render(<HeaderSection {...props} />);

        const objectMenuButton = screen.getByRole('button', {name: 'Object actions'});
        expect(objectMenuButton).toBeDisabled();
    });

    test('does not render when globalStatus is undefined', async () => {
        const props = {
            ...defaultProps,
            globalStatus: undefined,
        };

        render(<HeaderSection {...props} />);

        expect(screen.queryByText('root/svc/svc1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('FiberManualRecordIcon')).not.toBeInTheDocument();
    });

    test('opens menu and logs position on button click', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {
        });
        render(<HeaderSection {...defaultProps} />);

        const button = screen.getByLabelText('Object actions');
        await userEvent.click(button);

        expect(defaultProps.setObjectMenuAnchor).toHaveBeenCalledWith(expect.anything());
        expect(console.log).toHaveBeenCalledWith('Object menu opened at:', expect.any(Object));
    });

    test('renders popper menu when objectMenuAnchor is set', () => {
        const mockAnchor = {
            getBoundingClientRect: jest.fn(() => ({})),
        };
        const props = {
            ...defaultProps,
            objectMenuAnchor: mockAnchor,
        };
        render(<HeaderSection {...props} />);

        expect(screen.getByTestId('popper')).toBeInTheDocument();
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    });

    test('handles object action click', async () => {
        const mockAnchor = {
            getBoundingClientRect: jest.fn(() => ({})),
        };
        const props = {
            ...defaultProps,
            objectMenuAnchor: mockAnchor,
        };
        render(<HeaderSection {...props} />);

        const menuItems = screen.getAllByRole('menuitem');
        await userEvent.click(menuItems[0]);

        expect(defaultProps.handleObjectActionClick).toHaveBeenCalledWith('delete');
        expect(defaultProps.setObjectMenuAnchor).toHaveBeenCalledWith(null);
    });

    test('disables menu items when not allowed', () => {
        isActionAllowedForSelection.mockReturnValue(false);
        const mockAnchor = {
            getBoundingClientRect: jest.fn(() => ({})),
        };
        const props = {
            ...defaultProps,
            objectMenuAnchor: mockAnchor,
        };
        render(<HeaderSection {...props} />);

        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems[0]).toHaveAttribute('data-disabled', 'true');
    });

    test('configures popperProps correctly for Safari', () => {
        global.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15';
        const mockAnchor = {
            getBoundingClientRect: jest.fn(() => ({})),
        };
        const props = {
            ...defaultProps,
            objectMenuAnchor: mockAnchor,
        };
        render(<HeaderSection {...props} />);

        expect(screen.getByTestId('popper')).toBeInTheDocument();
    });

    test('adjusts popper offset based on zoom level', () => {
        Object.defineProperty(window, 'devicePixelRatio', {
            value: 2,
            writable: true,
        });
        const mockAnchor = {
            getBoundingClientRect: jest.fn(() => ({})),
        };
        const props = {
            ...defaultProps,
            objectMenuAnchor: mockAnchor,
        };
        render(<HeaderSection {...props} />);

        expect(screen.getByTestId('popper')).toBeInTheDocument();
    });
});
