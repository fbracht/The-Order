import React, { useState } from 'react';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';
import { estimateTotalComparisons } from '../utils/rankingEngine';
import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from '../utils/security';

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

  const handleDevFill = () => {
    setText(`Arcs
Root
Oath
Pax Pamir
John Company
Molly House`);
    setError(null);
  };

  const lineCount = text.split('\n').filter(l => l.trim().length > 0).length;
  const isValid = lineCount >= 2;
  
  // Time Estimation Logic
  const estimatedComparisons = estimateTotalComparisons(lineCount);
  const estimatedSeconds = estimatedComparisons * 2;
  
  // Only show estimate if it's 2 minutes (120 seconds) or more
  const showTimeEstimate = estimatedSeconds >= 120;
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
        
        {/* Header: increase margin on desktop. */}
        <header className="flex-none mb-8 md:mb-10 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-3">
            Create your set
          </h1>
          <p className="text-gray-500 text-lg font-light">
            List the items you want to rank, one per line.
          </p>
        </header>

        {/* 
          Input Container:
          Mobile: flex-1, min-h-0 (grow to fill space between header and footer)
          Desktop: flex-none, w-full (don't grow, stick to header)
        */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center mb-6 md:mb-0 md:flex-none">
          {/* 
            TextArea Wrapper:
            Mobile: h-full (fill the flex-1 container)
            Desktop: h-96 (fixed height 24rem)
          */}
          <div className="w-full h-full md:h-96 relative group">
            <div className={`absolute -inset-0.5 bg-gradient-to-r ${error ? 'from-red-200 to-red-100' : 'from-gray-200 to-gray-100'} rounded-2xl opacity-50 group-hover:opacity-100 transition duration-500 blur-sm`}></div>
            <textarea
              value={text}
              onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
              }}
              placeholder={`Avocado\nBanana\nCoconut\n...`}
              className="relative w-full h-full p-6 bg-white rounded-2xl border-0 shadow-sm text-lg text-gray-800 placeholder:text-gray-300 focus:ring-2 focus:ring-gray-200/50 focus:outline-none resize-none leading-relaxed transition-all"
              spellCheck={false}
            />
            
            {/* Dev Helper Button */}
            <button
              onClick={handleDevFill}
              className="absolute bottom-4 right-4 z-20 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 text-xs font-bold rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm"
              title="Fill preset list"
            >
              DEV SET
            </button>
          </div>
          
          {/* Error Message Display */}
          {error && (
            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 text-red-500 text-sm font-medium text-center bg-red-50 px-3 py-1 rounded-lg border border-red-100"
            >
                {error}
            </motion.div>
          )}
        </div>
        
        {/* Footer section: Add margin top on desktop */}
        <div className="flex-none w-full max-w-xs mx-auto md:mt-8">
          <div className="flex justify-between items-end mb-2 px-1 h-5">
            <span className={`text-xs font-medium tracking-wide uppercase ${lineCount > MAX_LIST_SIZE ? 'text-red-500' : 'text-gray-400'}`}>
              {lineCount} {lineCount === 1 ? 'Item' : 'Items'} 
              {lineCount > MAX_LIST_SIZE && ` (Max ${MAX_LIST_SIZE})`}
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