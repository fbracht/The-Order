import React, { useState } from 'react';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';
import { estimateTotalComparisons } from '../utils/rankingEngine';
import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from '../utils/security';
import { getRandomPreset, PRESETS } from '../utils/presets';

interface InputScreenProps {
  onStart: (items: string[]) => void;
  initialValue?: string[];
}

export const InputScreen: React.FC<InputScreenProps> = ({ onStart, initialValue }) => {
  const [text, setText] = useState(initialValue ? initialValue.join('\n') : '');
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setError(null);

    // Split and initial trim
    let items = text.split('\n');

    // Security & Validation Pass
    const cleanedItems: string[] = [];

    for (const line of items) {
      // Sanitize and enforce max length per item
      const clean = sanitizeString(line, MAX_ITEM_LENGTH);
      if (clean.length > 0) {
        cleanedItems.push(clean);
      }
    }

    // Remove duplicates
    const uniqueItems = Array.from(new Set(cleanedItems));

    // Validation Checks
    if (uniqueItems.length < 2) {
      setError("Please enter at least 2 unique items to rank.");
      return;
    }

    if (uniqueItems.length > MAX_LIST_SIZE) {
      setError(`To ensure performance, please limit your list to ${MAX_LIST_SIZE} items.`);
      return;
    }

    onStart(uniqueItems);
  };

  const handleSurpriseMe = () => {
    const newItems = getRandomPreset(text);
    setText(newItems.join('\n'));
    setError(null);
  };

  const lines = text.split('\n');
  const lineCount = lines.filter(l => l.trim().length > 0).length;

  // Check for lines exceeding MAX_ITEM_LENGTH
  const hasLongLines = lines.some(line => line.trim().length > MAX_ITEM_LENGTH);
  const isTooLarge = lineCount > MAX_LIST_SIZE;

  // Check for duplicates (case-insensitive, trimmed)
  const trimmedLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  const uniqueItems = new Set(trimmedLines.map(l => l.toLowerCase()));
  const hasDuplicates = uniqueItems.size < trimmedLines.length;

  const isValid = lineCount >= 2 && !hasLongLines && !isTooLarge && !hasDuplicates;

  // Visibility Logic for Surprise Me button
  // Visible if:
  // 1. Current list has fewer than 3 items (0, 1, or 2)
  // 2. OR Current list is exactly equal to one of the presets (user hasn't edited it yet)
  const isPreset = PRESETS.some(p => p.join('\n') === text.trim());
  const showSurpriseButton = lineCount < 3 || isPreset;

  // Time Estimation Logic
  const estimatedComparisons = estimateTotalComparisons(lineCount);
  const estimatedSeconds = estimatedComparisons * 2;

  // Only show estimate if it's 2 minutes (120 seconds) or more
  const showTimeEstimate = estimatedSeconds >= 120 && !isTooLarge;
  const timeText = showTimeEstimate ? `${Math.floor(estimatedSeconds / 60)} min` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      // Use h-full to fill the 100dvh container from App.tsx
      // pt-36 (increased from pt-24) pushes content down from the floating navbar on mobile
      // pb-8 adds safe spacing at the bottom
      // md:justify-center centers the content block vertically on desktop
      className="h-full w-full flex flex-col pt-36 pb-8 px-4 sm:px-6 md:justify-center"
    >
      {/* 
        Inner wrapper:
        Mobile: h-full (fills screen for flex distribution)
        Desktop: h-auto (shrinks to fit content, centered by parent)
      */}
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full md:h-auto">

        {/* Header */}
        <header className="flex-none mb-8 md:mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-black mb-6 uppercase">
            Create<br />List
          </h1>
          <p className="text-gray-500 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed">
            What do you want to rank today? <br />
            <span className="text-gray-400 text-base">Enter items, one per line.</span>
          </p>
        </header>

        {/* Input Container */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center mb-6 md:mb-0 md:flex-none">
          <div className="w-full h-full md:h-96 relative group">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              placeholder={`Avocado\nBanana\nCoconut\n...`}
              className={`relative w-full h-full p-8 bg-white rounded-[2rem] border-2 shadow-xl text-2xl font-bold text-black placeholder:text-gray-200 focus:ring-4 focus:ring-black/5 focus:border-black/10 focus:outline-none resize-none leading-relaxed transition-all ${hasLongLines || isTooLarge || hasDuplicates ? 'border-red-200 focus:border-red-300' : 'border-gray-100'}`}
              spellCheck={false}
            />

            {/* Surprise Me Button */}
            {showSurpriseButton && (
              <button
                onClick={handleSurpriseMe}
                className="absolute bottom-6 right-6 z-20 px-4 py-2 bg-black text-white hover:bg-gray-800 text-sm font-bold rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg transform active:scale-95"
                title="Load a random list"
              >
                Surprise Me
              </button>
            )}
          </div>

          {/* Validation Warnings */}
          {(hasLongLines || isTooLarge || hasDuplicates || error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-white text-sm font-bold text-center bg-red-500 px-4 py-2 rounded-full shadow-lg"
            >
              {isTooLarge ? `Please limit your list to ${MAX_LIST_SIZE} items.` :
                hasLongLines ? "One or more lines exceed 100 characters." :
                  hasDuplicates ? "Duplicate items detected." :
                    error}
            </motion.div>
          )}
        </div>

        {/* Footer section: Add margin top on desktop */}
        <div className="flex-none w-full max-w-xs mx-auto md:mt-8">
          <div className="flex justify-between items-end mb-2 px-1 h-5">
            <span className={`text-xs font-medium tracking-wide uppercase ${(isTooLarge || hasLongLines || hasDuplicates) ? 'text-red-500' : 'text-gray-400'}`}>
              {lineCount} {lineCount === 1 ? 'Item' : 'Items'}
              {(isTooLarge || hasLongLines || hasDuplicates) && <span className="ml-1">⚠️</span>}
            </span>
            {timeText && !error && (
              <span className="text-xs text-gray-400 font-medium tracking-wide uppercase flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeText}
              </span>
            )}
          </div>

          <Button
            onClick={handleStart}
            disabled={!isValid}
            fullWidth
            className="transform transition-transform active:scale-95"
          >
            Begin Ranking
          </Button>
        </div>
      </div>
    </motion.div>
  );
};