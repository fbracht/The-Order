import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Item } from '../types';
import { getRankingState, checkpointsFor } from '../utils/rankingEngine';
import { motion, AnimatePresence } from 'framer-motion';

// --- Visual Components for Hints ---

const KeyCap = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center justify-center min-w-[1.6em] h-[1.6em] px-1 text-[0.9em] font-bold font-sans text-gray-500 bg-white border border-gray-300 rounded mx-0.5 shadow-[0_1px_0_rgba(0,0,0,0.1)] relative -top-0.5 select-none whitespace-nowrap align-middle">
    {children}
  </span>
);

const ArrowLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" />
  </svg>
);

const CheckIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

// --- Main Component ---

interface ComparisonScreenProps {
  items: Item[];
  edges: [string, string][];
  onDecision: (winner: Item, loser: Item) => void;
  onUndo: () => void;
  /** partial is true when the user stopped early with a Top N. */
  onComplete: (sortedItems: Item[], partial: boolean) => void;
}

// How many further picks a "stop here?" offer stays on screen
const OFFER_LIFETIME = 6;

const getIsLandscape = () =>
  typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches;

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  items,
  edges,
  onDecision,
  onUndo,
  onComplete
}) => {
  // Everything about the ranking is derived from the answers so far, so undo
  // and resume need no extra bookkeeping here.
  const engine = useMemo(() => getRankingState(items, edges), [items, edges]);
  const currentPair = engine.pair;

  // Set when the user stops early with a Top N
  const [stoppedList, setStoppedList] = useState<Item[] | null>(null);
  const finalList = engine.done ? engine.ranked : stoppedList;
  const isFinished = finalList !== null;

  // Device and Orientation detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLandscape, setIsLandscape] = useState(getIsLandscape);

  useEffect(() => {
    const checkState = () => {
      // Desktop check (mouse/trackpad usually implies desktop)
      setIsDesktop(window.matchMedia('(pointer: fine)').matches);
      setIsLandscape(getIsLandscape());
    };

    checkState();
    window.addEventListener('resize', checkState);
    window.addEventListener('orientationchange', checkState);

    return () => {
      window.removeEventListener('resize', checkState);
      window.removeEventListener('orientationchange', checkState);
    };
  }, []);

  // Let the progress bar fill and the checkmarks play before moving on
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!finalList) return;
    const partial = !engine.done;
    const timer = setTimeout(() => onCompleteRef.current(finalList, partial), 800);
    return () => clearTimeout(timer);
  }, [finalList, engine.done]);

  // Guards against a second tap or key press landing on the same question
  // before the next one has rendered.
  const answeredAtRef = useRef(-1);
  useEffect(() => {
    answeredAtRef.current = -1;
  }, [edges]);

  const handleChoice = (choice: 'LEFT' | 'RIGHT') => {
    if (!currentPair || isFinished) return;
    if (answeredAtRef.current === edges.length) return;
    answeredAtRef.current = edges.length;

    const winner = choice === 'LEFT' ? currentPair.left : currentPair.right;
    const loser = choice === 'LEFT' ? currentPair.right : currentPair.left;
    onDecision(winner, loser);
  };

  const canUndo = edges.length > 0 && !isFinished;
  const handleUndo = () => {
    if (canUndo) onUndo();
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // A held key must not answer a run of questions
      if (e.repeat) return;
      if (e.key === '1' || e.key === 'ArrowLeft') handleChoice('LEFT');
      else if (e.key === '2' || e.key === 'ArrowRight') handleChoice('RIGHT');
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // --- Top N offers (long lists only) ---
  const checkpoints = useMemo(() => checkpointsFor(items.length), [items.length]);
  const settledCount = engine.ranked.length;
  const reached = checkpoints.reduce((best, k) => (k <= settledCount ? k : best), 0);

  // The highest checkpoint already offered. Starts at whatever is settled on
  // arrival, so resuming a session does not repeat an old offer.
  const offeredRef = useRef<number | null>(null);
  const [offer, setOffer] = useState<{ size: number; at: number } | null>(null);

  useEffect(() => {
    if (offeredRef.current === null) {
      offeredRef.current = reached;
      return;
    }
    if (reached > offeredRef.current) {
      offeredRef.current = reached;
      setOffer({ size: reached, at: edges.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reached]);

  const activeOffer =
    offer && !isFinished && settledCount >= offer.size && edges.length - offer.at < OFFER_LIFETIME
      ? offer
      : null;

  const handleStop = () => {
    if (!activeOffer) return;
    setStoppedList(engine.ranked.slice(0, activeOffer.size));
  };

  // Onboarding / Hint Logic
  const step = edges.length;
  let hintContent: React.ReactNode | null = null;
  let hintKey: string | null = null;

  if (step === 0) {
    hintKey = "step0";
    hintContent = "Select your favorite of these two options.";
  } else if (step === 1) {
    hintKey = "step1";
    hintContent = "Keep choosing your favorites at each comparison. At the end, you'll get a ranking of everything.";
  } else if (step === 2) {
    if (isDesktop) {
      hintKey = "step2-desktop";
      hintContent = (
        <span>
          <strong className="font-extrabold">HINT:</strong> You can also make selections by pressing<br />
          <KeyCap>1</KeyCap> and <KeyCap>2</KeyCap>, or <KeyCap><ArrowLeftIcon /></KeyCap> and <KeyCap><ArrowRightIcon /></KeyCap>.
        </span>
      );
    } else if (!isLandscape) {
      // Only show the orientation hint if they are currently in portrait mode
      hintKey = "step2-mobile-portrait";
      hintContent = (
        <span>
          <strong className="font-extrabold">HINT:</strong> Try turning your screen horizontal. It's probably more comfortable for long sets!
        </span>
      );
    }
  }

  // --- Progress ---
  // Questions answered out of answered + expected remaining. It moves one
  // even step per pick, and jumps ahead when a pick lets the engine place
  // several items without asking.
  const progressPercent = isFinished
    ? 100
    : (edges.length / (edges.length + engine.expectedRemaining)) * 100;

  // Panels slide in from their outer edges when the screen opens
  const panelEnter = { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const };
  const firstPanelFrom = isLandscape ? { x: '-100%' } : { y: '-100%' };
  const secondPanelFrom = isLandscape ? { x: '100%' } : { y: '100%' };

  // Images stay clear of the logo: in portrait they are capped to the space
  // under it, in landscape to the half-width panel.
  const imageClass =
    'max-h-[calc(50dvh-13rem)] max-w-[80vw] landscape:max-h-[min(60dvh,calc(100dvh-14rem))] landscape:max-w-[40vw] rounded-2xl object-contain';

  return (
    // Layout switches from flex-col (vertical) to flex-row (horizontal) based on orientation (landscape)
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 w-full h-full flex flex-col landscape:flex-row bg-[#F5F5F7] overflow-hidden"
    >

      {/* Top / Left Panel (Option 1) - DARK MODE */}
      <motion.div
        initial={firstPanelFrom}
        animate={{ x: 0, y: 0 }}
        transition={panelEnter}
        className={`relative flex-1 flex flex-col items-center justify-end pb-14 landscape:justify-center landscape:pb-0 landscape:pt-10
        bg-black text-white
        ${isFinished ? '' : 'cursor-pointer active:opacity-95'} transition-opacity duration-200`}
        onClick={() => handleChoice('LEFT')}
      >
        <div className={`absolute inset-0 flex flex-col items-center justify-end pb-0 landscape:justify-center landscape:pb-0 pointer-events-none transition-opacity duration-500 ${isFinished ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-[120px] md:text-[240px] font-extrabold text-white/5 select-none leading-none tracking-tighter">1</span>
        </div>
        <AnimatePresence mode="popLayout">
          {isFinished ? (
            <motion.div
              key="done-left"
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="z-10 text-white/20"
            >
              <CheckIcon />
            </motion.div>
          ) : currentPair ? (
            <motion.div
              key={currentPair.left.id}
              layoutId={currentPair.left.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="z-10 text-center px-8 w-full max-w-xl mx-auto"
            >
              {currentPair.left.imageUrl ? (
                <div className="flex flex-col items-center">
                  <img src={currentPair.left.imageUrl} alt={currentPair.left.label} className={`${imageClass} shadow-2xl`} />
                  <h2 className="mt-4 text-xl md:text-3xl font-bold tracking-tight">{currentPair.left.label}</h2>
                </div>
              ) : (
                <h2 className="text-4xl md:text-7xl font-bold tracking-tight leading-tight text-balance">
                  {currentPair.left.label}
                </h2>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* Undo last choice */}
      <AnimatePresence>
        {canUndo && (
          <motion.button
            type="button"
            key="undo-choice"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={handleUndo}
            aria-label="Undo last choice"
            title="Undo last choice (Z)"
            className="fixed top-6 left-4 z-40 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* VS badge */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-gray-100">
          <span className="text-xl md:text-2xl font-extrabold text-black">VS</span>
        </div>
      </div>

      {/* Progress Indicator - Minimal bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 h-2 bg-gray-200 z-50">
        <motion.div
          className="h-full bg-black"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Bottom / Right Panel (Option 2) - LIGHT MODE */}
      <motion.div
        initial={secondPanelFrom}
        animate={{ x: 0, y: 0 }}
        transition={panelEnter}
        className={`relative flex-1 flex flex-col items-center justify-start pt-14 landscape:justify-center landscape:pt-10
        bg-white text-black
        ${isFinished ? '' : 'cursor-pointer active:bg-gray-50'} transition-colors duration-200`}
        onClick={() => handleChoice('RIGHT')}
      >
        <div className={`absolute inset-0 flex flex-col items-center justify-start pt-0 landscape:justify-center landscape:pt-0 pointer-events-none transition-opacity duration-500 ${isFinished ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-[120px] md:text-[240px] font-extrabold text-black/5 select-none leading-none tracking-tighter">2</span>
        </div>
        <AnimatePresence mode="popLayout">
          {isFinished ? (
            <motion.div
              key="done-right"
              initial={{ scale: 0.5, opacity: 0, rotate: 20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="z-10 text-black/20"
            >
              <CheckIcon />
            </motion.div>
          ) : currentPair ? (
            <motion.div
              key={currentPair.right.id}
              layoutId={currentPair.right.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="z-10 text-center px-8 w-full max-w-xl mx-auto"
            >
              {currentPair.right.imageUrl ? (
                <div className="flex flex-col items-center">
                  <img src={currentPair.right.imageUrl} alt={currentPair.right.label} className={`${imageClass} shadow-xl`} />
                  <h2 className="mt-4 text-xl md:text-3xl font-bold tracking-tight">{currentPair.right.label}</h2>
                </div>
              ) : (
                <h2 className="text-4xl md:text-7xl font-bold tracking-tight leading-tight text-balance">
                  {currentPair.right.label}
                </h2>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* Bottom panel: a "stop here?" offer when a Top N is settled, otherwise onboarding hints */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none z-40">
        <AnimatePresence mode="wait">
          {activeOffer ? (
            <motion.div
              key={`offer-${activeOffer.size}`}
              role="status"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-black/90 backdrop-blur-md shadow-2xl rounded-[1.75rem] pl-6 pr-3 py-3 pointer-events-auto max-w-lg border border-white/10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
            >
              <span className="text-sm font-bold text-white leading-snug">
                Your Top {activeOffer.size} is settled.
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-black hover:bg-gray-200 transition-colors"
                >
                  Stop here
                </button>
                <button
                  type="button"
                  onClick={() => setOffer(null)}
                  className="rounded-full border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                >
                  Keep going
                </button>
              </span>
            </motion.div>
          ) : !isFinished && hintKey && hintContent ? (
            <motion.div
              key={hintKey}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-black/90 backdrop-blur-md shadow-2xl rounded-full px-6 py-3 text-center pointer-events-auto max-w-lg border border-white/10"
            >
              <div className="text-sm font-bold text-white leading-relaxed">
                {hintContent}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

    </motion.div>
  );
};
