'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import QualityThresholdSettings from '@/components/admin/QualityThresholdSettings';

export default function QualityThresholdsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-6 w-6 text-[#D2045B]" />
          <h1 className="text-2xl font-bold text-white">Quality Thresholds Settings</h1>
        </div>
        <p className="text-sm text-gray-400">
          Administer platform-wide and genre-specific AI song quality thresholds (powered by Mastra
          AI + NVIDIA). Automated upload ingestion enforces these bars to maintain high sonic
          standards across the catalog.
        </p>
      </div>

      <QualityThresholdSettings />
    </div>
  );
}
