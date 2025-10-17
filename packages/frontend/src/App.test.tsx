import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the main heading', () => {
    render(<App />);
    expect(screen.getByText('Network Simulator')).toBeInTheDocument();
  });

  it('renders the welcome message', () => {
    render(<App />);
    expect(
      screen.getByText(/Welcome to the Network Simulator/)
    ).toBeInTheDocument();
  });
});
