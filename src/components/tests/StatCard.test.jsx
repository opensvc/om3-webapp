import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { Paper, Typography } from '@mui/material';
import '@testing-library/jest-dom';

// Mock MUI components to inspect their props
jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Paper: jest.fn(({ children, ...props }) => <div {...props}>{children}</div>),
    Typography: jest.fn(({ children, ...props }) => <p {...props}>{children}</p>),
}));

describe('StatCard Component', () => {
    const mockProps = {
        title: 'Total Users',
        value: '1,234',
        subtitle: 'Active this month',
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders correctly with all props', () => {
        render(<StatCard {...mockProps} />);

        // Check that Paper is rendered with the correct props
        expect(Paper).toHaveBeenCalledWith(
            expect.objectContaining({
                elevation: 3,
                onClick: mockProps.onClick,
                'data-testid': 'stat-card-total-users',
            }),
            expect.anything()
        );

        // Check Typography usage
        expect(Typography).toHaveBeenCalledWith(
            expect.objectContaining({
                variant: 'h6',
                children: 'Total Users',
                'data-testid': 'stat-card-title-total-users',
            }),
            expect.anything()
        );

        expect(Typography).toHaveBeenCalledWith(
            expect.objectContaining({
                variant: 'h3',
                color: 'primary',
                children: '1,234',
                'data-testid': 'stat-card-value-total-users',
            }),
            expect.anything()
        );

        expect(Typography).toHaveBeenCalledWith(
            expect.objectContaining({
                variant: 'body2',
                children: 'Active this month',
            }),
            expect.anything()
        );
    });

    test('renders without subtitle when not provided', () => {
        const { subtitle, ...propsWithoutSubtitle } = mockProps;
        render(<StatCard {...propsWithoutSubtitle} />);

        // Check that the subtitle is not rendered
        const subtitleElements = screen.queryAllByText('Active this month');
        expect(subtitleElements).toHaveLength(0);
    });

    test('handles click event', () => {
        render(<StatCard {...mockProps} />);

        const card = screen.getByTestId('stat-card-total-users');
        fireEvent.click(card);

        expect(mockProps.onClick).toHaveBeenCalledTimes(1);
    });

    test('applies correct styles on hover', () => {
        render(<StatCard {...mockProps} />);

        expect(Paper).toHaveBeenCalledWith(
            expect.objectContaining({
                sx: expect.objectContaining({
                    '&:hover': {
                        boxShadow: 6,
                        transition: 'box-shadow 0.3s ease-in-out'
                    }
                })
            }),
            expect.anything()
        );
    });

    test('generates correct test IDs for complex titles', () => {
        const complexTitleProps = {
            ...mockProps,
            title: 'Complex Title With Spaces',
        };
        render(<StatCard {...complexTitleProps} />);

        expect(screen.getByTestId('stat-card-complex-title-with-spaces')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-title-complex-title-with-spaces')).toBeInTheDocument();
        expect(screen.getByTestId('stat-card-value-complex-title-with-spaces')).toBeInTheDocument();
    });

    test('renders with default props', () => {
        const { subtitle, onClick, ...defaultProps } = mockProps;
        render(<StatCard {...defaultProps} />);

        // Check that the component renders correctly with minimal props
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.queryByText('Active this month')).not.toBeInTheDocument();
    });
});
