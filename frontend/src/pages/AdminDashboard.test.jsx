import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthContext } from '../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const activeSessions = [
  {
    session_id: 42,
    guest_name: 'Jordan',
    created_at: '2026-04-13T10:00:00Z',
    message_count: 2,
    status: 'pending_review',
    messages: [
      { id: 1, role: 'user', content: 'hello', timestamp: '2026-04-13T10:00:00Z' },
      { id: 2, role: 'assistant', content: 'hi', timestamp: '2026-04-13T10:00:02Z' },
    ],
  },
];

describe('AdminDashboard session actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.includes('archive')) {
        return Promise.resolve({ data: { items: [], has_next: false } });
      }
      if (url.includes('/export')) {
        return Promise.resolve({ data: activeSessions[0] });
      }
      return Promise.resolve({ data: { items: activeSessions, has_next: false } });
    });
    api.delete.mockResolvedValue({ data: { status: 'success' } });
    api.post.mockResolvedValue({ data: { status: 'success' } });
  });

  it('opens discard confirmation modal', async () => {
    render(
      <AuthContext.Provider value={{ logout: vi.fn() }}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan • Session #42')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Discard'));
    expect(screen.getByText('Discard Session?')).toBeInTheDocument();
    expect(screen.getByText('Confirm Discard')).toBeInTheDocument();
  });

  it('switches to archive view and calls restore endpoint', async () => {
    api.get.mockImplementation((url) => {
      if (url.includes('archive')) {
        return Promise.resolve({
          data: {
            items: [
            {
              ...activeSessions[0],
              status: 'discarded',
              discarded_at: '2026-04-13T11:00:00Z',
            },
            ],
            has_next: false,
          },
        });
      }
      if (url.includes('/export')) {
        return Promise.resolve({ data: activeSessions[0] });
      }
      return Promise.resolve({ data: { items: activeSessions, has_next: false } });
    });

    render(
      <AuthContext.Provider value={{ logout: vi.fn() }}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Viewing Active Sessions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Viewing Active Sessions'));

    await waitFor(() => {
      expect(screen.getByText('Restore Session')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Restore Session'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/admin/sessions/42/restore');
    });
  });

  it('includes a guest chat shortcut in the admin header', async () => {
    const logout = vi.fn();

    render(
      <AuthContext.Provider value={{ logout }}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan • Session #42')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('Chat as Guest')[0]);

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('closes the mobile sidebar after switching to analytics', async () => {
    render(
      <AuthContext.Provider value={{ logout: vi.fn() }}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Jordan • Session #42')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByTestId('admin-sidebar').className).toContain('translate-x-0');
    expect(screen.getByTestId('admin-sidebar-backdrop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^analytics$/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('admin-sidebar-backdrop')).not.toBeInTheDocument();
      expect(screen.getByTestId('admin-sidebar').className).toContain('-translate-x-full');
    });
  });
});
