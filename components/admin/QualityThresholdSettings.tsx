'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  RotateCcw,
  Save,
  Sparkles,
  Info,
  CheckCircle,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getGenreThresholds,
  setGenreThreshold,
  setGenreThresholds,
  resetGenreThresholds,
  getThresholdFeedback,
  DEFAULT_GENRE_THRESHOLDS,
  type ThresholdFeedback,
} from '@/lib/qualityThresholds';

export interface QualityThresholdSettingsProps {
  /** Optional custom class name */
  className?: string;
  /** Callback fired after saving changes */
  onSave?: (thresholds: Record<string, number>) => void;
}

export default function QualityThresholdSettings({
  className = '',
  onSave,
}: QualityThresholdSettingsProps) {
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [selectedGenre, setSelectedGenre] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [newGenreName, setNewGenreName] = useState('');
  const [newGenreScore, setNewGenreScore] = useState('0.70');
  const [showAddForm, setShowAddForm] = useState(false);

  // Initialize from storage/module
  useEffect(() => {
    setThresholds(getGenreThresholds());
  }, []);

  const feedback: ThresholdFeedback = useMemo(() => {
    return getThresholdFeedback(selectedGenre === 'default' ? undefined : selectedGenre);
  }, [selectedGenre, thresholds]);

  const handleSliderChange = (genre: string, value: number) => {
    setThresholds((prev) => ({
      ...prev,
      [genre]: Number(value.toFixed(2)),
    }));
    setSaveStatus(null);
  };

  const handleSave = () => {
    setGenreThresholds(thresholds);
    setSaveStatus('Changes saved successfully!');
    if (onSave) {
      onSave(thresholds);
    }
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
  };

  const handleResetDefaults = () => {
    resetGenreThresholds();
    const defaults = getGenreThresholds();
    setThresholds(defaults);
    setSaveStatus('Reset to default platform thresholds.');
    if (onSave) {
      onSave(defaults);
    }
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
  };

  const handleResetSingle = (genre: string) => {
    const defaultVal = DEFAULT_GENRE_THRESHOLDS[genre] ?? DEFAULT_GENRE_THRESHOLDS.default ?? 0.7;
    setGenreThreshold(genre, defaultVal);
    setThresholds((prev) => ({
      ...prev,
      [genre]: defaultVal,
    }));
  };

  const handleApplyFeedback = () => {
    const suggested = feedback.suggestedMinConfidenceScore;
    const target = selectedGenre;
    setThresholds((prev) => ({
      ...prev,
      [target]: suggested,
    }));
    setGenreThreshold(target, suggested);
    setSaveStatus(`Applied recommended score (${Math.round(suggested * 100)}%) for ${target}`);
    setTimeout(() => {
      setSaveStatus(null);
    }, 4000);
  };

  const handleAddGenre = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGenreName.trim().toLowerCase();
    if (!clean) return;
    const num = parseFloat(newGenreScore);
    const score = isNaN(num) ? 0.7 : Math.min(1, Math.max(0, num));
    setGenreThreshold(clean, score);
    setThresholds((prev) => ({
      ...prev,
      [clean]: score,
    }));
    setNewGenreName('');
    setShowAddForm(false);
    setSelectedGenre(clean);
  };

  const filteredGenres = useMemo(() => {
    const entries = Object.entries(thresholds);
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([genre]) => genre.toLowerCase().includes(q));
  }, [thresholds, searchQuery]);

  const getTierLabel = (val: number) => {
    if (val >= 0.8)
      return {
        label: 'Strict / High-Fidelity',
        color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      };
    if (val >= 0.7)
      return { label: 'Balanced', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    return {
      label: 'Relaxed / Ambient',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    };
  };

  return (
    <div className={`space-y-8 ${className}`} data-testid="quality-threshold-settings">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-[#D2045B]" />
            <h2 className="text-xl font-bold text-white">Quality Thresholds Tuning</h2>
            <span className="rounded-full bg-[#D2045B]/15 px-2.5 py-0.5 text-xs font-semibold text-[#D2045B] border border-[#D2045B]/30">
              Admin
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Tune minimum AI quality confidence scores required for automated upload approval.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-lg border border-gray-700 hover:border-gray-600 bg-[#1E1E1E] transition-colors"
            title="Reset all thresholds to defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#D2045B] hover:bg-[#b0034c] rounded-lg transition-colors shadow-sm"
          >
            <Save className="h-3.5 w-3.5" />
            Save Changes
          </button>
        </div>
      </div>

      {saveStatus && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400"
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Adaptive Feedback Recommendation Card */}
      <div className="rounded-xl border border-gray-700 bg-[#1E1E1E] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D2045B]/15 text-[#D2045B]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                Adaptive Feedback Loop Recommendation
              </h3>
              <p className="text-xs text-gray-400">
                Aggregated from admin moderation overrides to auto-tune strictness.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="feedback-genre-select" className="text-xs text-gray-400">
              Focus Genre:
            </label>
            <select
              id="feedback-genre-select"
              aria-label="Focus Genre"
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white capitalize focus:border-[#D2045B] focus:outline-none"
            >
              {Object.keys(thresholds).map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-black/30 p-3 border border-gray-800/80">
            <span className="text-xs text-gray-400">Overrides Analyzed</span>
            <div className="text-lg font-bold text-white mt-0.5">{feedback.overridesRecorded}</div>
          </div>
          <div className="rounded-lg bg-black/30 p-3 border border-gray-800/80">
            <span className="text-xs text-gray-400">Approval Reversals</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {feedback.approvalReversals}
            </div>
          </div>
          <div className="rounded-lg bg-black/30 p-3 border border-gray-800/80">
            <span className="text-xs text-gray-400">Rejection Reversals</span>
            <div className="text-lg font-bold text-rose-400 mt-0.5">
              {feedback.rejectionReversals}
            </div>
          </div>
          <div className="rounded-lg bg-black/30 p-3 border border-gray-800/80">
            <span className="text-xs text-gray-400">Suggested Target</span>
            <div className="text-lg font-bold text-[#D2045B] mt-0.5">
              {Math.round(feedback.suggestedMinConfidenceScore * 100)}%
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-gray-900/60 p-3.5 border border-gray-800">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-[#D2045B] shrink-0 mt-0.5" />
            <p className="text-xs text-gray-300 leading-relaxed">{feedback.recommendation}</p>
          </div>
          <button
            type="button"
            onClick={handleApplyFeedback}
            className="shrink-0 self-end sm:self-auto rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors border border-white/20"
          >
            Apply Suggested Score
          </button>
        </div>
      </div>

      {/* Search and Add Genre Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search genre thresholds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-[#1E1E1E] pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-[#D2045B] focus:outline-none"
            aria-label="Search genres"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-[#1E1E1E] px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          {showAddForm ? 'Cancel' : 'Add Custom Genre'}
        </button>
      </div>

      {/* Add Custom Genre Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddGenre}
          className="flex flex-col sm:flex-row items-end gap-3 rounded-xl border border-gray-700 bg-[#1E1E1E] p-4"
        >
          <div className="flex-1 w-full">
            <label
              htmlFor="new-genre-name-input"
              className="block text-xs font-medium text-gray-400 mb-1"
            >
              Genre Name
            </label>
            <input
              id="new-genre-name-input"
              type="text"
              placeholder="e.g. synthwave, afrobeat"
              value={newGenreName}
              onChange={(e) => setNewGenreName(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-[#D2045B] focus:outline-none"
              required
            />
          </div>
          <div className="w-full sm:w-36">
            <label
              htmlFor="new-genre-threshold-input"
              className="block text-xs font-medium text-gray-400 mb-1"
            >
              Threshold (0 - 1.0)
            </label>
            <input
              id="new-genre-threshold-input"
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={newGenreScore}
              onChange={(e) => setNewGenreScore(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white focus:border-[#D2045B] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto rounded-lg bg-[#D2045B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#b0034c] transition-colors"
          >
            Add Genre
          </button>
        </form>
      )}

      {/* Genre Sliders List */}
      <div className="space-y-4">
        {filteredGenres.map(([genre, threshold]) => {
          const tier = getTierLabel(threshold);
          const percent = Math.round(threshold * 100);

          return (
            <div
              key={genre}
              data-testid={`genre-row-${genre}`}
              className="rounded-xl border border-gray-700 bg-[#1E1E1E] p-4 transition-colors hover:border-gray-600"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold text-white capitalize text-sm">{genre}</span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${tier.color}`}
                  >
                    {tier.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-white">{percent}%</span>
                  <button
                    type="button"
                    onClick={() => handleResetSingle(genre)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                    title={`Reset ${genre} to default`}
                    aria-label={`Reset ${genre}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Slider & Range Input */}
              <div className="mt-3 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => handleSliderChange(genre, parseFloat(e.target.value))}
                  aria-label={`${genre} threshold slider`}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-[#D2045B]"
                />
              </div>

              <div className="mt-1 flex justify-between text-[11px] text-gray-500 font-mono">
                <span>0% (Permissive)</span>
                <span>Current: {threshold.toFixed(2)}</span>
                <span>100% (Strict)</span>
              </div>
            </div>
          );
        })}

        {filteredGenres.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400 border border-dashed border-gray-700 rounded-xl">
            No genres matched &quot;{searchQuery}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}
