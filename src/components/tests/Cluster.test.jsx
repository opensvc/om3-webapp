import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {StatCard} from '../StatCard';

describe('StatCard Component', () => {
    const mockOnClick = jest.fn();

    const renderStatCard = (props = {}) => {
        const defaultProps = {
            title: 'Test Title',
            value: '42',
            onClick: mockOnClick,
            ...props
        };
        return render(<StatCard {...defaultProps} />);
    };

    test('renders with title and value', () => {
        renderStatCard();
        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    test('renders with string subtitle', () => {
        renderStatCard({subtitle: 'Subtitle text'});
        expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    });

    test('renders with React element subtitle', () => {
        renderStatCard({subtitle: <div>Complex content</div>});
        expect(screen.getByText('Complex content')).toBeInTheDocument();
    });

    test('calls onClick when clicked', () => {
        const {container} = renderStatCard();
        const paper = container.querySelector('.MuiPaper-root');
        fireEvent.click(paper);
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('does not render subtitle when not provided', () => {
        renderStatCard();
        expect(screen.queryByTestId('subtitle')).not.toBeInTheDocument();
    });

    test('applies dynamic height when enabled', () => {
        const {container} = renderStatCard({dynamicHeight: true});
        const paper = container.querySelector('.MuiPaper-root');
        expect(paper).toHaveStyle('height: auto');
    });

    test('applies fixed height by default', () => {
        const {container} = renderStatCard();
        const paper = container.querySelector('.MuiPaper-root');
        expect(paper).toHaveStyle('height: 240px');
    });
});
