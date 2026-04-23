import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthContext } from '../context/AuthContext';
import Login from './Login';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('Login page', () => {
  it('shows loading and backend error feedback during login', async () => {
    const deferred = createDeferred();
    const login = vi.fn(() => deferred.promise);

    render(
      <AuthContext.Provider value={{ login }}>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByPlaceholderText('admin@lukabot.com'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('• • • • • • • •'), { target: { value: 'bad-password' } });
    fireEvent.click(screen.getByRole('button', { name: /access dashboard/i }));

    expect(screen.getByRole('button', { name: /accessing/i })).toBeDisabled();

    deferred.reject({ response: { data: { detail: 'Invalid credentials provided' } } });

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials provided')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /access dashboard/i })).toBeEnabled();
    expect(login).toHaveBeenCalledTimes(1);
  });
});