import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {StatCard} from '../StatCard';
import '@testing-library/jest-dom';

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

        const card = screen.getByRole('button', {name: /Total Users stat card/i});
        expect(card).toBeInTheDocument();

        expect(screen.getByText('Total Users')).toHaveAttribute('aria-label', 'Total Users title');
        expect(screen.getByText('1,234')).toHaveAttribute('aria-label', 'Total Users value');
        expect(screen.getByText('Active this month')).toHaveAttribute('aria-label', 'Total Users subtitle');
    });

    test('renders without subtitle when not provided', () => {
        const {subtitle, ...propsWithoutSubtitle} = mockProps;
        render(<StatCard {...propsWithoutSubtitle} />);

        expect(screen.getByRole('button', {name: /Total Users stat card/i})).toBeInTheDocument();
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.queryByText('Active this month')).not.toBeInTheDocument();
    });

    test('handles click event', () => {
        render(<StatCard {...mockProps} />);

        const card = screen.getByRole('button', {name: /Total Users stat card/i});
        fireEvent.click(card);

        expect(mockProps.onClick).toHaveBeenCalledTimes(1);
    });

    test('applies correct styles on hover', () => {
        render(<StatCard {...mockProps} />);

        const card = screen.getByRole('button', {name: /Total Users stat card/i});
        expect(card).toHaveStyle({
            textAlign: 'center',
            cursor: 'pointer',
        });
        // Note: Testing hover styles requires jsdom or a visual testing library like Cypress
    });

    test('generates correct content for complex titles', () => {
        const complexTitleProps = {
            ...mockProps,
            title: 'Complex Title With Spaces',
        };
        render(<StatCard {...complexTitleProps} />);

        const card = screen.getByRole('button', {name: /Complex Title With Spaces stat card/i});
        expect(card).toBeInTheDocument();
        expect(screen.getByText('Complex Title With Spaces')).toHaveAttribute('aria-label', 'Complex Title With Spaces title');
        expect(screen.getByText('1,234')).toHaveAttribute('aria-label', 'Complex Title With Spaces value');
        expect(screen.getByText('Active this month')).toHaveAttribute('aria-label', 'Complex Title With Spaces subtitle');
    });

    test('renders with default props', () => {
        const {subtitle, onClick, ...defaultProps} = mockProps;
        render(<StatCard {...defaultProps} />);

        expect(screen.getByRole('button', {name: /Total Users stat card/i})).toBeInTheDocument();
        expect(screen.getByText('Total Users')).toBeInTheDocument();
        expect(screen.getByText('1,234')).toBeInTheDocument();
        expect(screen.queryByText('Active this month')).not.toBeInTheDocument();
    });
});