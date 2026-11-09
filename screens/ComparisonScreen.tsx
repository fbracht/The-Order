import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Item, ComparisonPair } from '../types';
import { mergeSortGenerator } from '../utils/rankingEngine';
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
  onComplete: (sortedItems: Item[]) => void;
}

// A simple hook to manage the generator asynchronously
function useRankingEngine(items: Item[], edges: [string, string][]) {
  const [currentPair, setCurrentPair] = useState<ComparisonPair | null>(null);
  const generatorRef = useRef<AsyncGenerator<ComparisonPair, Item[], 'LEFT' | 'RIGHT'> | null>(null);
  const [sortedList, setSortedList] = useState<Item[] | null>(null);

  // Rebuild graph from edges
  const rebuildGraph = () => {
    const g = new Map<string, Set<string>>();
    // Helper to add edge
    const add = (w: string, l: string) => {
      if (!g.has(w)) g.set(w, new Set());
      g.get(w)!.add(l);
    };
    // Helper to check path
    const hasPath = (start: string, end: string, visited = new Set<string>()): boolean => {
      if (start === end) return true;
      if (visited.has(start)) return false;
      visited.add(start);
      const neighbors = g.get(start);
      if (neighbors) {
        for (const n of neighbors) {
          if (hasPath(n, end, visited)) return true;
        }
      }
      return false;
    };

    // Create a graph object compatible with our engine
    return {
      addEdge: (winner: Item, loser: Item) => add(winner.id, loser.id),
      hasPath: (start: Item, end: Item) => hasPath(start.id, end.id),
      addIds: add
    };
  };

  // Initialize or step the generator
  const nextStep = useCallback(async (lastDecision?: 'LEFT' | 'RIGHT') => {
    if (!generatorRef.current) return;

    const { value, done } = await generatorRef.current.next(lastDecision as any);

    if (done) {
      setSortedList(value as Item[]);
      setCurrentPair(null);
    } else {
      setCurrentPair(value as ComparisonPair);
    }
  }, []);

  // Initial setup
  useEffect(() => {
    // 1. Build graph wrapper
    const graphImpl = rebuildGraph();
    // 2. Hydrate graph with existing edges
    edges.forEach(([winnerId, loserId]) => graphImpl.addIds(winnerId, loserId));

    // 3. Start generator
    generatorRef.current = mergeSortGenerator(items, graphImpl as any);

    // 4. Kickoff
    nextStep();

    return () => {
      generatorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { currentPair, sortedList, nextStep };
}

export const ComparisonScreen: React.FC<ComparisonScreenProps> = ({
  items,
  edges,
  onDecision,
  onComplete
}) => {
  const { currentPair, sortedList, nextStep } = useRankingEngine(items, edges);

  // Device and Orientation detection
  const [isDesktop, setIsDesktop] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkState = () => {
      // Desktop check (mouse/trackpad usually implies desktop)
      const pointerMatch = window.matchMedia('(pointer: fine)');
      setIsDesktop(pointerMatch.matches);

      // Orientation check
      const landscapeMatch = window.matchMedia('(orientation: landscape)');
      setIsLandscape(landscapeMatch.matches);
    };

    // Initial check
    checkState();

    // Listeners for changes
    window.addEventListener('resize', checkState);
    window.addEventListener('orientationchange', checkState);

    return () => {
      window.removeEventListener('resize', checkState);
      window.removeEventListener('orientationchange', checkState);
    };
  }, []);

  // Handle completion delay
  useEffect(() => {
    if (sortedList) {
      // Wait for 0.8 seconds to allow progress bar to fill and the checkmark animation to play
      const timer = setTimeout(() => {
        onComplete(sortedList);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [sortedList, onComplete]);

  // Handle choice
  const handleChoice = (choice: 'LEFT' | 'RIGHT') => {
    if (!currentPair) return;

    const winner = choice === 'LEFT' ? currentPair.left : currentPair.right;
    const loser = choice === 'LEFT' ? currentPair.right : currentPair.left;

    onDecision(winner, loser); // Persist
    nextStep(choice); // Advance generator
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === 'ArrowLeft') handleChoice('LEFT');
      if (e.key === '2' || e.key === 'ArrowRight') handleChoice('RIGHT');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPair, nextStep]);

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

  // --- PROGRESS CALCULATION LOGIC ---
  // Calculates the percentage of total possible pairs that have been resolved (either directly or via inference).
  const progressPercent = useMemo(() => {
    if (sortedList) return 100; // Force 100% when finished
    if (items.length < 2) return 0;

    // 1. Build Adjacency List from current edges
    const adj = new Map<string, string[]>();
    for (const [w, l] of edges) {
      if (!adj.has(w)) adj.set(w, []);
      adj.get(w)!.push(l);
    }

    // 2. Calculate reachability (Transitive Closure)
    // For each item, count how many *other* items it can reach.
    // Sum of all reachable counts = Total number of resolved relationships (A > B).
    let totalResolved = 0;

    // Helper: Simple DFS/BFS to find all descendants
    const countReachable = (startNode: string): number => {
      let count = 0;
      const stack = [startNode];
      const visited = new Set<string>();
      visited.add(startNode);

      while (stack.length > 0) {
        const current = stack.pop()!;
        const neighbors = adj.get(current);
        if (neighbors) {
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              stack.push(neighbor);
              count++;
            }
          }
        }
      }
      return count;
    };

    // Run for every item
    for (const item of items) {
      totalResolved += countReachable(item.id);
    }

    // 3. Calculate against total possible pairs
    // Total unique pairs in a set of N is N * (N - 1) / 2
    const totalPairs = (items.length * (items.length - 1)) / 2;

    if (totalPairs === 0) return 0;

    // Cap at 95% until the final sorted list is actually returned by the engine
    const percent = (totalResolved / totalPairs) * 100;
    return Math.min(95, percent);
  }, [items, edges, sortedList]);


  // If no pair is active AND we aren't in the completion phase, show nothing (loading/init)
  if (!currentPair && !sortedList) return null;

  const isFinished = !!sortedList;

  return (
    // Layout switches from flex-col (vertical) to flex-row (horizontal) based on orientation (landscape)
    <div className="fixed inset-0 w-full h-full flex flex-col landscape:flex-row bg-[#F5F5F7] overflow-hidden">

      {/* Top / Left Panel (Option A) - DARK MODE */}
      <div
        className={`relative flex-1 flex flex-col items-center justify-end pb-14 landscape:justify-center landscape:pb-0 
        bg-black text-white
        ${isFinished ? '' : 'cursor-pointer group active:opacity-95'} transition-all duration-200`}
        onClick={() => !isFinished && handleChoice('LEFT')}
      >
        <div className={`absolute inset-0 flex flex-col items-center justify-end pb-0 landscape:justify-center landscape:pb-0 pointer-events-none transition-opacity duration-500 ${isFinished ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-[120px] md:text-[240px] font-extrabold text-white/5 select-none leading-none tracking-tighter">1</span>
        </div>
        <AnimatePresence mode="popLayout">
          {currentPair ? (
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
                  <img src={currentPair.left.imageUrl} alt={currentPair.left.label} className="max-h-[34vh] landscape:max-h-[60vh] max-w-[80vw] rounded-2xl object-contain shadow-2xl" />
                  <h2 className="mt-4 text-xl md:text-3xl font-bold tracking-tight">{currentPair.left.label}</h2>
                </div>
              ) : (
                <h2 className="text-4xl md:text-7xl font-bold tracking-tight leading-tight text-balance">
                  {currentPair.left.label}
                </h2>
              )}
              <div className="mt-6 opacity-0 group-hover:opacity-60 transition-opacity text-sm font-bold uppercase tracking-widest hidden md:block">
                Select Option A
              </div>
            </motion.div>
          ) : isFinished ? (
            <motion.div
              key="done-left"
              initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="z-10 text-white/20"
            >
              <CheckIcon />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Divider / Progress Bar - Now a floating pill */}
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

      {/* Bottom / Right Panel (Option B) - LIGHT MODE */}
      <div
        className={`relative flex-1 flex flex-col items-center justify-start pt-14 landscape:justify-center landscape:pt-0 
        bg-white text-black
        ${isFinished ? '' : 'cursor-pointer group active:bg-gray-50'} transition-all duration-200`}
        onClick={() => !isFinished && handleChoice('RIGHT')}
      >
        <div className={`absolute inset-0 flex flex-col items-center justify-start pt-0 landscape:justify-center landscape:pt-0 pointer-events-none transition-opacity duration-500 ${isFinished ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-[120px] md:text-[240px] font-extrabold text-black/5 select-none leading-none tracking-tighter">2</span>
        </div>
        <AnimatePresence mode="popLayout">
          {currentPair ? (
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
                  <img src={currentPair.right.imageUrl} alt={currentPair.right.label} className="max-h-[34vh] landscape:max-h-[60vh] max-w-[80vw] rounded-2xl object-contain shadow-xl" />
                  <h2 className="mt-4 text-xl md:text-3xl font-bold tracking-tight">{currentPair.right.label}</h2>
                </div>
              ) : (
                <h2 className="text-4xl md:text-7xl font-bold tracking-tight leading-tight text-balance">
                  {currentPair.right.label}
                </h2>
              )}
              <div className="mt-6 opacity-0 group-hover:opacity-40 transition-opacity text-sm font-bold uppercase tracking-widest hidden md:block">
                Select Option B
              </div>
            </motion.div>
          ) : isFinished ? (
            <motion.div
              key="done-right"
              initial={{ scale: 0.5, opacity: 0, rotate: 20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="z-10 text-black/20"
            >
              <CheckIcon />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Onboarding Info Panel */}
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none z-40">
        <AnimatePresence mode="wait">
          {!isFinished && hintKey && hintContent && (
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
          )}
        </AnimatePresence>
      </div>

    </div>
  );
};
