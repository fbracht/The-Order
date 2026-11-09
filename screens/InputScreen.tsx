import React, { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';
import { estimateTotalComparisons } from '../utils/rankingEngine';
import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from '../utils/security';
import { getRandomPreset, PRESETS } from '../utils/presets';
import { Item, ListType } from '../types';

interface InputScreenProps {
  onStart: (items: Item[], listType: ListType) => void;
  initialItems?: Item[];
  initialListType?: ListType;
}

const itemFromText = (label: string): Item => ({ id: label, label });

const filenameToLabel = (filename: string, fallbackIndex: number): string => {
  const withoutExtension = filename.replace(/\.[^/.]+$/, '');
  return sanitizeString(withoutExtension, MAX_ITEM_LENGTH) || `Image ${fallbackIndex}`;
};

export const InputScreen: React.FC<InputScreenProps> = ({
  onStart,
  initialItems = [],
  initialListType = 'TEXT'
}) => {
  const [listType, setListType] = useState<ListType>(initialListType);
  const [text, setText] = useState(initialItems.filter(item => !item.imageUrl).map(item => item.label).join('\n'));
  const [imageItems, setImageItems] = useState<Item[]>(initialItems.filter(item => item.imageUrl));
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStart = () => {
    setError(null);

    if (listType === 'IMAGES') {
      if (imageItems.length < 2) {
        setError('Please add at least 2 images to rank.');
        return;
      }
      onStart(imageItems, 'IMAGES');
      return;
    }

    // Split and initial trim
    const items = text.split('\n');

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

    onStart(uniqueItems.map(itemFromText), 'TEXT');
  };

  const addImages = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setError('Please select image files (PNG, JPEG, WebP, GIF, and similar formats).');
      return;
    }

    setImageItems(current => {
      const remainingSlots = MAX_LIST_SIZE - current.length;
      const acceptedFiles = validFiles.slice(0, remainingSlots);
      if (acceptedFiles.length < validFiles.length) {
        setError(`Please limit your list to ${MAX_LIST_SIZE} images.`);
      } else {
        setError(null);
      }

      return [
        ...current,
        ...acceptedFiles.map((file, index) => ({
          id: `image-${crypto.randomUUID()}`,
          label: filenameToLabel(file.name, current.length + index + 1),
          imageUrl: URL.createObjectURL(file)
        }))
      ];
    });
  };

  const removeImage = (id: string) => {
    setImageItems(current => {
      const item = current.find(candidate => candidate.id === id);
      if (item?.imageUrl) URL.revokeObjectURL(item.imageUrl);
      return current.filter(candidate => candidate.id !== id);
    });
    setError(null);
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

  const isTextValid = lineCount >= 2 && !hasLongLines && !isTooLarge && !hasDuplicates;
  const isImageValid = imageItems.length >= 2 && imageItems.length <= MAX_LIST_SIZE;
  const isValid = listType === 'TEXT' ? isTextValid : isImageValid;

  // Visibility Logic for Surprise Me button
  // Visible if:
  // 1. Current list has fewer than 3 items (0, 1, or 2)
  // 2. OR Current list is exactly equal to one of the presets (user hasn't edited it yet)
  const isPreset = PRESETS.some(p => p.join('\n') === text.trim());
  const showSurpriseButton = listType === 'TEXT' && (lineCount < 3 || isPreset);

  // Time Estimation Logic
  const itemCount = listType === 'TEXT' ? lineCount : imageItems.length;
  const estimatedComparisons = estimateTotalComparisons(itemCount);
  const estimatedSeconds = estimatedComparisons * 2;

  // Only show estimate if it's 2 minutes (120 seconds) or more
  const showTimeEstimate = estimatedSeconds >= 120 && (listType === 'IMAGES' || !isTooLarge);
  const timeText = showTimeEstimate ? `${Math.floor(estimatedSeconds / 60)} min` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      // The page itself never scrolls (body is fixed), so this screen scrolls
      // internally whenever the viewport is too short for its content.
      className="h-full w-full overflow-y-auto"
    >
      {/*
        Inner wrapper: at least as tall as the viewport, so the list box can
        grow into spare height. Top padding clears the floating navbar; it is
        tighter on short viewports such as a phone held sideways.
      */}
      <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full pt-36 md:pt-28 pb-8 px-4 sm:px-6 md:justify-center [@media(max-height:500px)]:pt-24">

        {/* Header */}
        <header className="flex-none mb-8 md:mb-10 text-center">
          <h1 className="text-5xl md:text-7xl [@media(max-height:820px)]:md:text-6xl font-extrabold tracking-tight text-black mb-6 uppercase">
            Create<br />List
          </h1>
          <p className="text-gray-500 text-lg md:text-xl font-medium max-w-md mx-auto leading-relaxed">
            What do you want to rank today? <br />
            <span className="text-gray-400 text-base">
              {listType === 'TEXT' ? 'Enter items, one per line.' : 'Add images, then choose your favorites.'}
            </span>
          </p>
        </header>

        <div className="flex-none mx-auto mb-6 inline-flex self-center rounded-full bg-white p-1 shadow-xs border border-gray-100" role="tablist" aria-label="List type">
          <button
            type="button"
            role="tab"
            aria-selected={listType === 'TEXT'}
            onClick={() => { setListType('TEXT'); setError(null); }}
            className={`rounded-full px-5 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors ${listType === 'TEXT' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
          >
            Text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={listType === 'IMAGES'}
            onClick={() => { setListType('IMAGES'); setError(null); }}
            className={`rounded-full px-5 py-2 text-sm font-extrabold uppercase tracking-wide transition-colors ${listType === 'IMAGES' ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'}`}
          >
            Images
          </button>
        </div>

        {/* Input Container */}
        <div className="flex-1 w-full flex flex-col items-center mb-6 md:mb-0 md:max-h-96">
          {/* Children are absolutely positioned so they fill this box at any height */}
          <div className="w-full flex-1 min-h-44 relative group">
            {listType === 'TEXT' ? (
              <>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={`Avocado\nBanana\nCoconut\n...`}
                  className={`absolute inset-0 w-full h-full p-8 bg-white rounded-[2rem] border-2 shadow-xl text-2xl font-bold text-black placeholder:text-gray-200 focus:ring-4 focus:ring-black/5 focus:border-black/10 focus:outline-none resize-none leading-relaxed transition-all ${hasLongLines || isTooLarge || hasDuplicates ? 'border-red-200 focus:border-red-300' : 'border-gray-100'}`}
                  spellCheck={false}
                />

                {showSurpriseButton && (
                  <button
                    type="button"
                    onClick={handleSurpriseMe}
                    className={`absolute bottom-6 right-6 z-20 px-4 py-2 bg-black text-white hover:bg-gray-800 text-sm font-bold rounded-full transition-all shadow-lg transform active:scale-95 ${lineCount === 0 || isPreset ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                    title="Load a random list"
                  >
                    Surprise Me
                  </button>
                )}
              </>
            ) : (
              <div
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  addImages(event.dataTransfer.files);
                }}
                className={`absolute inset-0 overflow-y-auto rounded-[2rem] border-2 bg-white p-5 shadow-xl transition-colors ${isDragging ? 'border-black bg-gray-50' : error ? 'border-red-200' : 'border-dashed border-gray-200'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    if (event.target.files) addImages(event.target.files);
                    event.target.value = '';
                  }}
                />
                {imageItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-full min-h-36 w-full rounded-2xl flex flex-col items-center justify-center text-center px-6 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-12 h-12 mb-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2 2 0 002 2h14a2 2 0 002-2v-1.5M16 8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xl font-extrabold text-black">Drop images here</span>
                    <span className="mt-2 text-sm font-medium text-gray-400">or click to choose files</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-2xl border border-dashed border-gray-300 py-4 text-sm font-extrabold uppercase tracking-wide text-gray-500 hover:border-black hover:text-black transition-colors"
                    >
                      Add more images
                    </button>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {imageItems.map((item) => (
                        <div key={item.id} className="group/image relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                          <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(item.id)}
                            className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-black/75 text-white opacity-100 sm:opacity-0 sm:group-hover/image:opacity-100 transition-opacity"
                            aria-label={`Remove ${item.label}`}
                          >
                            ×
                          </button>
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-xs font-bold text-white">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Validation Warnings */}
          {((listType === 'TEXT' && (hasLongLines || isTooLarge || hasDuplicates)) || error) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-white text-sm font-bold text-center bg-red-500 px-4 py-2 rounded-full shadow-lg"
            >
              {listType === 'TEXT' && isTooLarge ? `Please limit your list to ${MAX_LIST_SIZE} items.` :
                listType === 'TEXT' && hasLongLines ? "One or more lines exceed 100 characters." :
                  listType === 'TEXT' && hasDuplicates ? "Duplicate items detected." :
                    error}
            </motion.div>
          )}
        </div>

        {/* Footer section: Add margin top on desktop */}
        <div className="flex-none w-full max-w-xs mx-auto md:mt-8">
          <div className="flex justify-between items-end mb-2 px-1 h-5">
            <span className={`text-xs font-medium tracking-wide uppercase ${listType === 'TEXT' && (isTooLarge || hasLongLines || hasDuplicates) ? 'text-red-500' : 'text-gray-400'}`}>
              {itemCount} {itemCount === 1 ? (listType === 'TEXT' ? 'Item' : 'Image') : (listType === 'TEXT' ? 'Items' : 'Images')}
              {listType === 'TEXT' && (isTooLarge || hasLongLines || hasDuplicates) && <span className="ml-1">⚠️</span>}
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
