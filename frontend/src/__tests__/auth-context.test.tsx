/**
 * Tests for the useAuth hook (frontend/src/hooks/useAuth.ts).
 * This hook manages auth state: user, loading, login, logout.
 * It uses api (axios instance) and next/navigation's useRouter.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Mock api module
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedApi = api as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initial state: user is null and loading is true, then false after /auth/me resolves', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { data: null } });

    const { result } = renderHook(() => useAuth());

    // Initially loading = true
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets user after /auth/me returns user data', async () => {
    const fakeUser = { id: '1', name: 'Test User', email: 'test@example.com' };
    mockedApi.get.mockResolvedValueOnce({ data: { data: fakeUser } });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
  });

  it('after login() succeeds, user is set and router.push is called with /dashboard', async () => {
    // /auth/me called on mount — returns null initially
    mockedApi.get.mockResolvedValueOnce({ data: { data: null } });

    const fakeUser = { id: '2', name: 'Login User', email: 'login@example.com' };
    mockedApi.post.mockResolvedValueOnce({
      data: { data: { user: fakeUser } },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.login('login@example.com', 'password123');
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('after logout(), user is null and router.push is called with /login', async () => {
    const fakeUser = { id: '3', name: 'Logout User', email: 'logout@example.com' };
    // /auth/me on mount — authenticated user
    mockedApi.get.mockResolvedValueOnce({ data: { data: fakeUser } });
    // /auth/logout POST
    mockedApi.post.mockResolvedValueOnce({});

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('after logout(), user is null even if POST /auth/logout fails (graceful degradation)', async () => {
    const fakeUser = { id: '4', name: 'User', email: 'user@example.com' };
    mockedApi.get.mockResolvedValueOnce({ data: { data: fakeUser } });
    // logout endpoint fails
    mockedApi.post.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    // User is cleared even on failure (graceful degradation in useAuth)
    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
