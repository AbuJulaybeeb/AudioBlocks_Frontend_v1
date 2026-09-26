import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QualityThresholdSettings from '@/components/admin/QualityThresholdSettings';
import {
  resetGenreThresholds,
  recordAdminOverride,
  resetThresholdFeedback,
  getGenreThreshold,
} from '@/lib/qualityThresholds';

describe('QualityThresholdSettings component', () => {
  beforeEach(() => {
    resetThresholdFeedback();
    resetGenreThresholds();
  });

  it('renders heading, admin badge, and default genre thresholds', () => {
    render(<QualityThresholdSettings />);

    expect(screen.getByRole('heading', { name: /Quality Thresholds Tuning/i })).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByTestId('genre-row-classical')).toBeInTheDocument();
    expect(screen.getByTestId('genre-row-electronic')).toBeInTheDocument();
    expect(screen.getByTestId('genre-row-lofi')).toBeInTheDocument();
  });

  it('adjusts genre threshold and calls onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(<QualityThresholdSettings onSave={onSave} />);

    const classicalRow = screen.getByTestId('genre-row-classical');
    expect(classicalRow).toBeInTheDocument();

    const slider = screen.getByLabelText(/classical threshold slider/i);
    expect(slider).toBeInTheDocument();

    // Change slider value to 0.90
    fireEvent.change(slider, { target: { value: '0.90' } });

    // Click Save Changes
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(/Changes saved successfully/i);
    expect(getGenreThreshold('classical')).toBe(0.9);
  });

  it('displays adaptive feedback loop recommendation and applies suggested score', () => {
    // Record admin overrides: filter rejected classical, admin approved classical
    for (let i = 0; i < 5; i++) {
      recordAdminOverride({
        trackId: `track_${i}`,
        filterDecision: 'rejected',
        adminAction: 'approved',
        genre: 'classical',
      });
    }

    render(<QualityThresholdSettings />);

    // Change feedback focus genre to classical
    const genreSelect = screen.getByLabelText(/Focus Genre/i);
    fireEvent.change(genreSelect, { target: { value: 'classical' } });

    // Feedback should show 5 overrides and recommendation
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/lower minConfidenceScore/i)).toBeInTheDocument();

    // Click Apply Suggested Score
    const applyBtn = screen.getByRole('button', { name: /Apply Suggested Score/i });
    fireEvent.click(applyBtn);

    expect(screen.getByRole('status')).toHaveTextContent(/Applied recommended score/i);
  });

  it('filters genres based on search query', () => {
    render(<QualityThresholdSettings />);

    const searchInput = screen.getByRole('textbox', { name: /Search genres/i });
    fireEvent.change(searchInput, { target: { value: 'lofi' } });

    expect(screen.getByTestId('genre-row-lofi')).toBeInTheDocument();
    expect(screen.queryByTestId('genre-row-classical')).not.toBeInTheDocument();
  });

  it('allows adding a new custom genre threshold', () => {
    render(<QualityThresholdSettings />);

    const addBtn = screen.getByRole('button', { name: /Add Custom Genre/i });
    fireEvent.click(addBtn);

    const nameInput = screen.getByPlaceholderText(/e.g. synthwave/i);
    const scoreInput = screen.getByLabelText(/^Threshold \(0 - 1\.0\)$/i);

    fireEvent.change(nameInput, { target: { value: 'synthwave' } });
    fireEvent.change(scoreInput, { target: { value: '0.75' } });

    const submitBtn = screen.getByRole('button', { name: /^Add Genre$/i });
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('genre-row-synthwave')).toBeInTheDocument();
    expect(getGenreThreshold('synthwave')).toBe(0.75);
  });

  it('resets all thresholds when Reset Defaults is clicked', () => {
    render(<QualityThresholdSettings />);

    const slider = screen.getByLabelText(/classical threshold slider/i);
    fireEvent.change(slider, { target: { value: '0.50' } });

    const resetBtn = screen.getByRole('button', { name: /Reset Defaults/i });
    fireEvent.click(resetBtn);

    expect(screen.getByRole('status')).toHaveTextContent(/Reset to default platform thresholds/i);
    expect(getGenreThreshold('classical')).toBe(0.85);
  });
});
