import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {StatCard} from '../StatCard';

describe('StatCard Component', () => {
    const mockOnClick = jest.fn();

    test('renders with title and value', () => {
        render(<StatCard title="Test Title" value="42" onClick={mockOnClick}/>);

        expect(screen.getByText('Test Title')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    test('renders with string subtitle', () => {
        render(
            <StatCard
                title="Test"
                value="42"
                subtitle="Subtitle text"
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    });

    test('renders with React element subtitle', () => {
        render(
            <StatCard
                title="Test"
                value="42"
                subtitle={<div>Complex content</div>}
                onClick={mockOnClick}
            />
        );

        expect(screen.getByText('Complex content')).toBeInTheDocument();
    });

    test('calls onClick when clicked', () => {
        const {container} = render(
            <StatCard
                title="Test"
                value="42"
                onClick={mockOnClick}
            />
        );

        const card = container.firstChild;
        fireEvent.click(card);
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('does not render subtitle when not provided', () => {
        const {container} = render(
            <StatCard
                title="Test"
                value="42"
                onClick={mockOnClick}
            />
        );

        const typographyElements = container.querySelectorAll('.MuiTypography-root');
        expect(typographyElements.length).toBe(2);
    });

    test('applies dynamic height when enabled', () => {
        const {container} = render(
            <StatCard
                title="Test"
                value="42"
                onClick={mockOnClick}
                dynamicHeight
            />
        );

        const paper = container.querySelector('.MuiPaper-root');
        expect(paper).toHaveStyle('height: auto');
    });

    test('applies fixed height by default', () => {
        const {container} = render(
            <StatCard
                title="Test"
                value="42"
                onClick={mockOnClick}
            />
        );

        const paper = container.querySelector('.MuiPaper-root');
        expect(paper).toHaveStyle('height: 240px');
    });
});