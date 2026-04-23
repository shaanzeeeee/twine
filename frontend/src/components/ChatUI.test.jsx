import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthContext } from '../context/AuthContext';
import ChatUI from './ChatUI';

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('ChatUI guest onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requires guest name then updates greeting', async () => {
    render(
      <AuthContext.Provider value={{ user: null }}>
        <MemoryRouter>
          <ChatUI />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    expect(screen.getByText('Guest Mode')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type your name'), {
      target: { value: 'Jordan' },
    });
    fireEvent.click(screen.getByText('Start Guest Session'));

    await waitFor(() => {
      expect(screen.queryByText('Guest Mode')).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Welcome, Jordan' })).toBeInTheDocument();
  });

  it('keeps the mobile composer at a readable text size', async () => {
    render(
      <AuthContext.Provider value={{ user: null }}>
        <MemoryRouter>
          <ChatUI />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    const composer = screen.getByLabelText('Chat input');
    expect(composer).toHaveClass('text-base');
    expect(composer).toHaveClass('min-h-[52px]');
  });
});
