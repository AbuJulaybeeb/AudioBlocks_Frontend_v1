import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QualityThresholdsPage from '@/app/dashboard/settings/quality/page.tsx';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: React.ComponentProps<'a'>) => <a href={href}>{children}</a>,
}));

describe('QualityThresholdsPage (Admin Settings)', () => {
  it('renders navigation link and settings heading', () => {
    render(<QualityThresholdsPage />);

    expect(screen.getByRole('link', { name: /Back to Settings/i })).toHaveAttribute(
      'href',
      '/dashboard/settings'
    );
    expect(
      screen.getByRole('heading', { name: /Quality Thresholds Settings/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('quality-threshold-settings')).toBeInTheDocument();
  });
});
