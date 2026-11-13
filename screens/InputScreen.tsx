import React, { useRef, useState } from 'react';
import { Button } from '../components/Button';
import { AnimatePresence, motion } from 'framer-motion';
import { estimateTotalComparisons, estimateTopComparisons, checkpointsFor } from '../utils/rankingEngine';
import { sanitizeString, MAX_ITEM_LENGTH, MAX_LIST_SIZE } from '../utils/security';
import { getRandomPreset, PRESETS } from '../utils/presets';
import { Item, ListType } from '../types';
import { cleanPastedList, findDuplicates, removeDuplicates } from '../utils/listInput';

interface InputScreenProps {
  onStart: (items: Item[], listType: ListType) => void;
  initialItems?: Item[];
  initialListType?: ListType;
  /** The list arrived through a shared link. */
  isSharedList?: boolean;
}

const itemFromText = (label: string): Item => ({ id: label, label });

// Everything that changes with the Text/Images toggle uses this timing
const SWITCH = { duration: 0.25, ease: 'easeOut' } as const;

const filenameToLabel = (filename: string, fallbackIndex: number): string => {
  const withoutExtension = filename.replace(/\.[^/.]+$/, '');
  return sanitizeString(withoutExtension, MAX_ITEM_LENGTH) || `Image ${fallbackIndex}`;
};

export const InputScreen: React.FC<InputScreenProps> = ({
  onStart,
  initialItems = [],
  initialListType = 'TEXT',
  isSharedList = false
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

  // Pasted lists often come numbered, bulleted or comma-separated
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData('text/plain');
    const cleaned = cleanPastedList(pasted);
    if (cleaned === pasted) return;

    event.preventDefault();
    // insertText keeps the browser's own undo history working
    if (!document.execCommand('insertText', false, cleaned)) {
      const { selectionStart, selectionEnd } = event.currentTarget;
      setText(text.slice(0, selectionStart) + cleaned + text.slice(selectionEnd));
    }
    if (error) setError(null);
  };

  const handleRemoveDuplicates = () => {
    setText(removeDuplicates(text));
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

  const longLineNumbers = lines.flatMap((line, index) => (line.trim().length > MAX_ITEM_LENGTH ? [index + 1] : []));

  // Check for duplicates (case-insensitive, trimmed)
  const duplicates = findDuplicates(text);
  const hasDuplicates = duplicates !== null;

  // One plain sentence about what is wrong, naming the line where possible
  let problem: React.ReactNode = null;
  if (listType === 'TEXT' && isTooLarge) {
    problem = `Your list has ${lineCount} items. The limit is ${MAX_LIST_SIZE}.`;
  } else if (listType === 'TEXT' && hasLongLines) {
    const more = longLineNumbers.length - 1;
    problem = `Line ${longLineNumbers[0]} is longer than ${MAX_ITEM_LENGTH} characters${more > 0 ? `, and so ${more === 1 ? 'is 1 other' : `are ${more} others`}` : ''}.`;
  } else if (listType === 'TEXT' && duplicates) {
    const more = duplicates.extraCount - 1;
    problem = (
      <>
        “{duplicates.label}” is repeated on line {duplicates.line}{more > 0 ? `, and there ${more === 1 ? 'is 1 more repeat' : `are ${more} more repeats`}` : ''}.{' '}
        <button type="button" onClick={handleRemoveDuplicates} className="font-extrabold underline underline-offset-4 hover:no-underline">
          Remove duplicates
        </button>
      </>
    );
  } else if (error) {
    problem = error;
  }

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

  // Long lists can be stopped early once the top is settled
  const roundQuestions = (count: number) => (count >= 100 ? Math.round(count / 10) * 10 : Math.round(count / 5) * 5);
  const offersTopN = isValid && checkpointsFor(itemCount).includes(10);
  const topTenQuestions = offersTopN ? roundQuestions(estimateTopComparisons(itemCount, 10)) : 0;
  // The last wording is kept while the note fades out, so its numbers do not
  // change on the way.
  const topNNote = useRef('');
  if (offersTopN) {
    topNNote.current = `About ${topTenQuestions} questions for a Top 10, or ${roundQuestions(estimatedComparisons)} to rank everything. You can stop once the top is settled.`;
  }

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
      <div className="w-full max-w-2xl mx-auto flex flex-col min-h-full pt-28 pb-3 [@media(max-height:820px)]:pb-0 px-4 sm:px-6 md:justify-center [@media(max-height:500px)]:pt-24">

        {/* Header */}
        <header className="flex-none mb-5 md:mb-8 [@media(max-height:820px)]:md:mb-4 text-center">
          <h1 className="text-5xl md:text-7xl [@media(max-height:820px)]:md:text-6xl font-extrabold tracking-tight text-ink mb-4 md:mb-6 uppercase">
            Create<br />List
          </h1>
          <p className="text-muted text-lg md:text-xl font-medium max-w-md mx-auto leading-snug md:leading-relaxed">
            Pick between two at a time. <br className="hidden sm:inline" />
            We'll work out the full order.
          </p>
        </header>

        <div className="flex-none mx-auto mb-3 inline-flex self-center rounded-full bg-surface p-1 shadow-low border border-line" role="tablist" aria-label="List type">
          {(['TEXT', 'IMAGES'] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={listType === type}
              onClick={() => { setListType(type); setError(null); }}
              className={`relative min-h-11 rounded-full px-6 text-sm font-extrabold uppercase tracking-wide transition-colors duration-300 ${listType === type ? 'text-on-ink' : 'text-muted hover:text-ink'}`}
            >
              {/* One shared pill that slides between the two tabs */}
              {listType === type && (
                <motion.span
                  layoutId="list-type-pill"
                  className="absolute inset-0 rounded-full bg-ink"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{type === 'TEXT' ? 'Text' : 'Images'}</span>
            </button>
          ))}
        </div>

        {/* What to put in the box below; changes with the toggle above it */}
        <p className="flex-none h-6 mb-3 text-center text-muted text-base font-medium leading-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isSharedList && listType === 'TEXT' ? 'SHARED' : listType}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="inline-block"
            >
              {isSharedList && listType === 'TEXT'
                ? 'Someone shared this list with you. Edit it, or begin.'
                : listType === 'TEXT' ? 'Enter items, one per line.' : 'Add the images you want to rank.'}
            </motion.span>
          </AnimatePresence>
        </p>

        {/* Input Container */}
        <div className="flex-1 w-full flex flex-col items-center mb-6 md:mb-0 md:max-h-96">
          {/* Children are absolutely positioned so they fill this box at any height */}
          <div className="w-full flex-1 min-h-44 relative group">
            <AnimatePresence initial={false}>
            {listType === 'TEXT' ? (
              <motion.div
                key="text"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SWITCH}
                className="absolute inset-0"
              >
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (error) setError(null);
                  }}
                  onPaste={handlePaste}
                  aria-label="Your list, one item per line"
                  aria-invalid={hasLongLines || isTooLarge || hasDuplicates}
                  placeholder={`Avocado\nBanana\nCoconut\n...`}
                  className={`absolute inset-0 w-full h-full p-8 bg-surface rounded-[2rem] border-2 shadow-mid text-2xl font-bold text-ink placeholder:text-faint focus:ring-4 focus:ring-ink/5 focus:border-ink/20 focus:outline-none resize-none leading-relaxed transition-all ${hasLongLines || isTooLarge || hasDuplicates ? 'border-danger/40' : 'border-line'}`}
                  spellCheck={false}
                />

                {showSurpriseButton && (
                  <button
                    type="button"
                    onClick={handleSurpriseMe}
                    className={`absolute bottom-6 right-6 z-20 min-h-11 px-5 bg-ink text-on-ink hover:opacity-85 text-sm font-bold rounded-full transition-all shadow-mid transform active:scale-95 ${lineCount === 0 || isPreset ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                    title="Load a random list"
                  >
                    Surprise Me
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="images"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SWITCH}
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
                className={`absolute inset-0 overflow-y-auto rounded-[2rem] border-2 bg-surface p-5 shadow-mid transition-colors ${isDragging ? 'border-ink' : error ? 'border-danger/40' : 'border-dashed border-faint/60'}`}
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
                    className="h-full min-h-36 w-full rounded-2xl flex flex-col items-center justify-center text-center px-6 hover:bg-ink/5 transition-colors"
                  >
                    <svg className="w-12 h-12 mb-4 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18a2 2 0 002 2h14a2 2 0 002-2v-1.5M16 8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {/* Touch screens cannot drop files, so the wording follows the pointer */}
                    <span className="text-xl font-extrabold text-ink">
                      <span className="pointer-coarse:hidden">Drop images here</span>
                      <span className="hidden pointer-coarse:inline">Add images</span>
                    </span>
                    <span className="mt-2 text-sm font-medium text-muted">
                      <span className="pointer-coarse:hidden">or click to choose files</span>
                      <span className="hidden pointer-coarse:inline">Tap to choose from your photos or files</span>
                    </span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-2xl border border-dashed border-faint py-4 text-sm font-extrabold uppercase tracking-wide text-muted hover:border-ink hover:text-ink transition-colors"
                    >
                      Add more images
                    </button>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {imageItems.map((item) => (
                        <div key={item.id} className="group/image relative aspect-square overflow-hidden rounded-xl bg-chip">
                          <img src={item.imageUrl} alt={item.label} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(item.id)}
                            className="absolute right-1 top-1 h-9 w-9 rounded-full bg-black/75 text-white opacity-100 sm:opacity-0 sm:group-hover/image:opacity-100 transition-opacity"
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
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Validation Warnings */}
          <AnimatePresence initial={false}>
          {problem && (
            <motion.div
              key="warning"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SWITCH}
              className="flex-none w-full overflow-hidden"
            >
              <p role="alert" className="pt-3 px-2 text-center text-sm font-semibold text-danger">
                {problem}
              </p>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* Footer section: Add margin top on desktop */}
        <div className="flex-none w-full max-w-xs mx-auto md:mt-8 [@media(max-height:820px)]:md:mt-4">
          <motion.div
            key={listType}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={SWITCH}
            className="flex justify-between items-end mb-2 px-1 h-5"
          >
            <span className={`text-xs font-semibold tracking-wide uppercase ${listType === 'TEXT' && (isTooLarge || hasLongLines || hasDuplicates) ? 'text-danger' : 'text-muted'}`}>
              {itemCount} {itemCount === 1 ? (listType === 'TEXT' ? 'Item' : 'Image') : (listType === 'TEXT' ? 'Items' : 'Images')}
            </span>
            {timeText && !error && (
              <span className="text-xs text-muted font-semibold tracking-wide uppercase flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {timeText}
              </span>
            )}
          </motion.div>

          <Button
            onClick={handleStart}
            disabled={!isValid}
            fullWidth
            className="transform transition-transform active:scale-95"
          >
            Begin Ranking
          </Button>

          {/* The space for this note is always kept, so it can come and go
              without moving the rest of the screen. It is a plain CSS fade:
              the note stays in the page and only its opacity changes. */}
          <p
            aria-hidden={!offersTopN}
            className={`min-h-[3.25rem] pt-3 text-center text-xs font-medium leading-relaxed text-muted transition-opacity duration-200 ease-out ${offersTopN ? 'opacity-100' : 'opacity-0'}`}
          >
            {topNNote.current}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
