import React from 'react';
import {render, screen} from '@testing-library/react';
import HeaderSection from '../HeaderSection';
import {isActionAllowedForSelection} from '../../utils/objectUtils';

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
        Popper: ({children, open, anchorEl, ...props}) =>
            open ? <div data-testid="popper" {...props}>{children}</div> : null,
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
jest.mock('@mui/icons-material/WarningAmber', () => () => (
    <svg data-testid="WarningAmberIcon"/>
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
    });

    test('renders object name and status icons', async () => {
        render(<HeaderSection {...defaultProps} />);

        // Vérifier que le nom de l'objet est rendu
        expect(screen.getByText('root/svc/svc1')).toBeInTheDocument();

        // Vérifier les icônes de statut
        expect(screen.getByTestId('FiberManualRecordIcon')).toBeInTheDocument();
        expect(screen.getByTestId('AcUnitIcon')).toBeInTheDocument();
        expect(screen.queryByTestId('WarningAmberIcon')).not.toBeInTheDocument();
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
        expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
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
        expect(screen.getAllByTestId('WarningAmberIcon')).toHaveLength(1); // Not provisioned icon
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
});
