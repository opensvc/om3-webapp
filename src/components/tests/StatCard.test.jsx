import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import StatCard from '../StatCard';

describe('StatCard Component', () => {
    const mockOnClick = jest.fn();

    beforeEach(() => {
        mockOnClick.mockClear();
    });

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
        render(<StatCard title="Test" value="42" onClick={mockOnClick}/>);
        // eslint-disable-next-line testing-library/no-node-access
        const card = screen.getByText('Test').closest('div');
        fireEvent.click(card);
        expect(mockOnClick).toHaveBeenCalled();
    });

    test('does not render subtitle when not provided', () => {
        render(<StatCard title="Test" value="42" onClick={mockOnClick}/>);
        const typographyElements = screen.getAllByRole('heading');
        expect(typographyElements).toHaveLength(2);
    });

    test('applies dynamic height when enabled', () => {
        render(<StatCard title="Test" value="42" onClick={mockOnClick} dynamicHeight/>);
        // eslint-disable-next-line testing-library/no-node-access
        const paper = screen.getByText('Test').closest('div');
        expect(paper).toHaveStyle('height: auto');
    });

    test('applies fixed height by default', () => {
        render(<StatCard title="Test" value="42" onClick={mockOnClick}/>);
        // eslint-disable-next-line testing-library/no-node-access
        const paper = screen.getByText('Test').closest('div');
        expect(paper).toHaveStyle('height: 240px');
    });

    test('does not call onClick when not provided', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        render(<StatCard title="Test" value="42" />);
        // eslint-disable-next-line testing-library/no-node-access
        const card = screen.getByText('Test').closest('div');
        fireEvent.click(card);
        expect(mockOnClick).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('does not have pointer cursor when onClick is not provided', () => {
        render(<StatCard title="Test" value="42" />);
        // eslint-disable-next-line testing-library/no-node-access
        const paper = screen.getByText('Test').closest('div');
        expect(paper).toHaveStyle('cursor: default');
    });

    test('has pointer cursor when onClick is provided', () => {
        render(<StatCard title="Test" value="42" onClick={mockOnClick} />);
        // eslint-disable-next-line testing-library/no-node-access
        const paper = screen.getByText('Test').closest('div');
        expect(paper).toHaveStyle('cursor: pointer');
    });

    test('stops event propagation when clicking on subtitle', () => {
        const subtitleMockClick = jest.fn();
        const cardMockClick = jest.fn();

        render(
            <StatCard
                title="Test"
                value="42"
                subtitle={<button onClick={subtitleMockClick}>Subtitle</button>}
                onClick={cardMockClick}
            />
        );

        const subtitleButton = screen.getByText('Subtitle');
        fireEvent.click(subtitleButton);

        expect(subtitleMockClick).toHaveBeenCalled();
        expect(cardMockClick).not.toHaveBeenCalled();
    });

    test('renders without onClick and without dynamicHeight', () => {
        render(<StatCard title="Test" value="42" />);
        expect(screen.getByText('Test')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    test('handles click event with stopPropagation for string subtitle', () => {
        const cardMockClick = jest.fn();

        render(
            <StatCard
                title="Test"
                value="42"
                subtitle="Test Subtitle"
                onClick={cardMockClick}
            />
        );

        const subtitleElement = screen.getByText('Test Subtitle');
        fireEvent.click(subtitleElement);

        expect(cardMockClick).not.toHaveBeenCalled();
    });
});
