import React, { useState, useEffect, useRef } from 'react';
import { Item, RankingState } from './types';
import { InputScreen } from './screens/InputScreen';
import { ComparisonScreen } from './screens/ComparisonScreen';
import { ResultScreen } from './screens/ResultScreen';
import { Navbar } from './components/Navbar';
import { AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'the_order_state_v1';

const INITIAL_STATE: RankingState = {
  status: 'INPUT',
  items: [],
  edges: []
};

// Fisher-Yates shuffle helper
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function App() {
  const [state, setState] = useState<RankingState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_STATE;
    } catch {
      return INITIAL_STATE;
    }
  });

  // Final sorted list is ephemeral until completion, but we store it here for the Results view
  const [finalList, setFinalList] = useState<Item[]>([]);

  // Navigation History State
  const [previousState, setPreviousState] = useState<RankingState | null>(null);
  const [showUndoNav, setShowUndoNav] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Handle the temporary undo button timer
  useEffect(() => {
    if (showUndoNav) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setShowUndoNav(false);
        setPreviousState(null); // Clear history if time expires
      }, 4000);
    }
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [showUndoNav]);

  const handleStart = (items: Item[]) => {
    // If user starts a new session, clear any pending undo functionality
    setShowUndoNav(false);
    setPreviousState(null);

    // Shuffle items initially so the comparison pairs are not deterministic based on input order
    setState({
      status: 'COMPARING',
      items: shuffle(items),
      edges: []
    });
  };

  const handleDecision = (winner: Item, loser: Item) => {
    setState(prev => ({
      ...prev,
      edges: [...prev.edges, [winner, loser]]
    }));
  };

  const handleComplete = (sortedItems: Item[]) => {
    setFinalList(sortedItems);
    setState(prev => ({ ...prev, status: 'RESULTS' }));
  };

  // Reset completely to a new empty set
  const handleReset = () => {
    if (state.status === 'COMPARING') {
      if (!window.confirm("Start a new set? Current progress will be lost.")) return;
    }
    
    // Hard reset
    setState({
      status: 'INPUT',
      items: [],
      edges: []
    });
    setFinalList([]);
    setShowUndoNav(false);
    setPreviousState(null);
  };

  // Restart ranking with the SAME items
  const handleRestart = () => {
    const itemsToRank = state.items.length > 0 ? state.items : finalList;

    setState({
        status: 'COMPARING',
        // Always shuffle on restart to provide a fresh comparison path
        items: shuffle(itemsToRank), 
        edges: []
    });
    setShowUndoNav(false);
    setPreviousState(null);
  };

  // Navigation Handlers
  const handleLogoClick = () => {
    if (state.status === 'INPUT') return;

    // Snapshot current state before navigating away
    setPreviousState(state);
    setShowUndoNav(true);

    // Go to input, keeping current items so InputScreen populates
    setState(prev => ({
      ...prev,
      status: 'INPUT'
    }));
  };

  const handleUndoNav = () => {
    if (previousState) {
      setState(previousState);
      setPreviousState(null);
      setShowUndoNav(false);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#F5F5F7] font-sans antialiased text-[#1D1D1F]">
      <Navbar 
        onLogoClick={handleLogoClick}
        isLogoClickable={state.status !== 'INPUT'}
        showUndo={showUndoNav}
        onUndo={handleUndoNav}
      />
      {/* 
        Container for screens. 
        Removed pt-24 here because screens now handle their own padding 
        to accommodate fixed viewports and internal scrolling 
      */}
      <div className="h-full w-full">
        <AnimatePresence mode="wait">
          {state.status === 'INPUT' && (
            <InputScreen 
              key="input" 
              onStart={handleStart} 
              initialValue={state.items} 
            />
          )}
          
          {state.status === 'COMPARING' && (
            <ComparisonScreen 
              key="comparing"
              items={state.items}
              edges={state.edges}
              onDecision={handleDecision}
              onComplete={handleComplete}
            />
          )}
          
          {state.status === 'RESULTS' && (
            <ResultScreen 
              key="results"
              items={finalList.length > 0 ? finalList : state.items}
              onReset={handleReset}
              onRestart={handleRestart}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;