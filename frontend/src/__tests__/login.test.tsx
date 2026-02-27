import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';

// Mock useAuth hook
const mockLogin = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    loading: false,
  }),
}));

// Mock lucide-react icons used in the page
vi.mock('lucide-react', () => ({
  Megaphone: () => null,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('seu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('******')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('shows API error message when login fails', async () => {
    mockLogin.mockRejectedValueOnce({
      response: { data: { message: 'Credenciais inválidas' } },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('******'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByText('Credenciais inválidas')).toBeInTheDocument();
    });
  });

  it('shows generic error message when login fails without response data', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('******'), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByText('Erro ao fazer login')).toBeInTheDocument();
    });
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('******'), {
      target: { value: 'mypassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'mypassword');
    });
  });
});
