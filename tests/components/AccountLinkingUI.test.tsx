import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountLinkingUI from '@/components/auth/AccountLinkingUI';

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Default mock for usePrivy
let mockUsePrivy: Record<string, unknown> = {};

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => mockUsePrivy,
}));

describe('AccountLinkingUI Component (#471)', () => {
  const mockLinkEmail = vi.fn();
  const mockUnlinkEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePrivy = {
      ready: true,
      authenticated: true,
      user: {
        id: 'user_123',
        wallet: {
          address: '0x1234567890abcdef1234567890abcdef12345678',
        },
        email: null,
        linkedAccounts: [
          {
            type: 'wallet',
            address: '0x1234567890abcdef1234567890abcdef12345678',
          },
        ],
      },
      linkEmail: mockLinkEmail,
      unlinkEmail: mockUnlinkEmail,
    };
  });

  it('renders wallet address and "Link Email" CTA when no email is linked', () => {
    render(<AccountLinkingUI />);

    expect(screen.getByTestId('account-linking-ui')).toBeInTheDocument();
    expect(screen.getByText(/Connected Wallet:/i)).toBeInTheDocument();
    expect(screen.getByText(/0x1234\.\.\.5678/i)).toBeInTheDocument();
    expect(screen.getByText(/No email linked/i)).toBeInTheDocument();
    expect(screen.getByTestId('link-email-btn')).toBeInTheDocument();
  });

  it('triggers linkEmail when "Link Email" button is clicked', async () => {
    mockLinkEmail.mockResolvedValueOnce(undefined);
    const onLinkSuccess = vi.fn();

    render(<AccountLinkingUI onLinkSuccess={onLinkSuccess} />);

    const linkBtn = screen.getByTestId('link-email-btn');
    fireEvent.click(linkBtn);

    expect(mockLinkEmail).toHaveBeenCalledTimes(1);
  });

  it('renders linked email address and "Linked" badge when user has an email', () => {
    mockUsePrivy = {
      ready: true,
      authenticated: true,
      user: {
        id: 'user_123',
        wallet: {
          address: '0x1234567890abcdef1234567890abcdef12345678',
        },
        email: {
          address: 'artist@audioblocks.io',
        },
        linkedAccounts: [
          {
            type: 'wallet',
            address: '0x1234567890abcdef1234567890abcdef12345678',
          },
          {
            type: 'email',
            address: 'artist@audioblocks.io',
          },
        ],
      },
      linkEmail: mockLinkEmail,
      unlinkEmail: mockUnlinkEmail,
    };

    render(<AccountLinkingUI />);

    expect(screen.getByText('artist@audioblocks.io')).toBeInTheDocument();
    expect(screen.getByTestId('email-linked-badge')).toBeInTheDocument();
    expect(screen.getByTestId('unlink-email-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('link-email-btn')).not.toBeInTheDocument();
  });

  it('calls unlinkEmail when unlink button is clicked', async () => {
    mockUnlinkEmail.mockResolvedValueOnce(undefined);
    const onUnlinkSuccess = vi.fn();

    mockUsePrivy = {
      ready: true,
      authenticated: true,
      user: {
        id: 'user_123',
        email: {
          address: 'test@example.com',
        },
        linkedAccounts: [
          {
            type: 'email',
            address: 'test@example.com',
          },
        ],
      },
      linkEmail: mockLinkEmail,
      unlinkEmail: mockUnlinkEmail,
    };

    render(<AccountLinkingUI onUnlinkSuccess={onUnlinkSuccess} />);

    const unlinkBtn = screen.getByTestId('unlink-email-btn');
    fireEvent.click(unlinkBtn);

    expect(mockUnlinkEmail).toHaveBeenCalledWith('test@example.com');
    await waitFor(() => {
      expect(onUnlinkSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('handles linkEmail error and displays error message', async () => {
    mockLinkEmail.mockRejectedValueOnce(new Error('Network connection error'));

    render(<AccountLinkingUI />);

    const linkBtn = screen.getByTestId('link-email-btn');
    fireEvent.click(linkBtn);

    await waitFor(() => {
      expect(screen.getByTestId('account-linking-error')).toHaveTextContent(
        'Network connection error'
      );
    });
  });
});
