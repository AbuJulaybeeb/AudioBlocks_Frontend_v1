import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthGuard } from '@/components/auth/AuthGuard';

const mockUseRequireAuth = vi.fn();

vi.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: (options: unknown) => mockUseRequireAuth(options),
}));

describe('AuthGuard (#470)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when authenticated and ready', () => {
    mockUseRequireAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <AuthGuard>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders fallback when unauthenticated', () => {
    mockUseRequireAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <AuthGuard fallback={<div data-testid="fallback">Redirecting to login...</div>}>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('renders fallback while loading', () => {
    mockUseRequireAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <AuthGuard fallback={<div data-testid="spinner">Loading...</div>}>
        <div data-testid="protected-content">Secret Content</div>
      </AuthGuard>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
});
