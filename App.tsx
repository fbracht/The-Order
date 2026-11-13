import React, { useState, useEffect, useRef } from 'react';
import { Item, ListType, RankingState } from './types';
import { InputScreen } from './screens/InputScreen';
import { ComparisonScreen } from './screens/ComparisonScreen';
import { ResultScreen } from './screens/ResultScreen';
import { Navbar } from './components/Navbar';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { decodeListHash } from './utils/shareLink';
import { saveImages, loadImageUrls, clearImages } from './utils/imageStore';
import { compareKey } from './utils/compare';

const STORAGE_KEY = 'the_order_state_v1';

const INITIAL_STATE: RankingState = {
  status: 'INPUT',
  listType: 'TEXT',
  items: [],
  edges: []
};

function readSaved(): any | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

const itemsOrUndefined = (value: unknown): Item[] | undefined => (Array.isArray(value) ? value : undefined);

function restoreState(): RankingState {
  const parsed = readSaved();
  if (!parsed) return INITIAL_STATE;

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const status = parsed.status === 'COMPARING' || parsed.status === 'RESULTS' ? parsed.status : 'INPUT';
  const edges = Array.isArray(parsed.edges) ? parsed.edges : [];

  // Migrate sessions created before list types and item metadata existed.
  if (items.every((item: unknown) => typeof item === 'string')) {
    return { status, listType: 'TEXT', items: items.map((label: string) => ({ id: label, label })), edges };
  }

  // Image sessions need their pictures loaded from the browser database
  // first, which cannot be done here; see the start-up effect in App.
  if (parsed.listType === 'IMAGES') return { ...INITIAL_STATE, listType: 'IMAGES' };

  return {
    status,
    listType: 'TEXT',
    items,
    inputItems: itemsOrUndefined(parsed.inputItems),
    edges,
    finalItems: itemsOrUndefined(parsed.finalItems),
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    finishedAt: typeof parsed.finishedAt === 'number' ? parsed.finishedAt : undefined,
    theirRanking: Array.isArray(parsed.theirRanking) && parsed.theirRanking.every((label: unknown) => typeof label === 'string')
      ? parsed.theirRanking
      : undefined
  };
}

const withoutImageUrls = (items?: Item[]) => items?.map(({ id, label }) => ({ id, label }));

// Fisher-Yates shuffle helper
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const sameItems = (a: Item[] | undefined, b: Item[]) =>
  !!a && a.length === b.length && new Set(a.map(item => item.id)).size === new Set([...a, ...b].map(item => item.id)).size;

const sharesItems = (theirRanking: string[] | undefined, items: Item[]) => {
  if (!theirRanking) return false;
  const theirs = new Set(theirRanking.map(compareKey));
  return items.filter(item => theirs.has(compareKey(item.label))).length >= 2;
};

function App() {
  const [state, setState] = useState<RankingState>(() => restoreState());

  // True while a shared list or a saved image ranking is being loaded at
  // start-up. Nothing is drawn or saved until that has finished.
  const [isHydrating, setIsHydrating] = useState(
    () => window.location.hash.includes('list=') || readSaved()?.listType === 'IMAGES'
  );
  // Bumped to make the input screen start over with new content
  const [inputVersion, setInputVersion] = useState(0);
  const [isSharedList, setIsSharedList] = useState(false);
  // Whether the uploaded images are safely in the browser database
  const [imagesSaved, setImagesSaved] = useState(false);

  // Navigation History State
  const [previousState, setPreviousState] = useState<RankingState | null>(null);
  const [showUndoNav, setShowUndoNav] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start-up: a list link wins over a saved session; otherwise bring back a
  // saved image ranking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shared = await decodeListHash(window.location.hash);
      if (cancelled) return;

      if (shared) {
        // A list that comes with a ranking arrives in ranked order. It is shown
        // alphabetically, so the friend's order stays unknown until the end.
        const labels = shared.ranking ? [...shared.labels].sort((a, b) => a.localeCompare(b)) : shared.labels;
        const items = labels.map(label => ({ id: label, label }));
        setState({ ...INITIAL_STATE, items, inputItems: items, theirRanking: shared.ranking });
        setIsSharedList(true);
        setInputVersion(version => version + 1);
      } else {
        const saved = readSaved();
        if (saved?.listType === 'IMAGES' && Array.isArray(saved.items) && saved.items.length > 0) {
          try {
            const urls = await loadImageUrls(saved.items.map((item: Item) => item.id));
            if (cancelled) return;
            if (urls) {
              const withUrls = (items?: Item[]) => items?.map(item => ({ ...item, imageUrl: urls.get(item.id) }));
              setState({
                status: saved.status === 'RESULTS' ? 'RESULTS' : 'COMPARING',
                listType: 'IMAGES',
                items: withUrls(saved.items)!,
                inputItems: withUrls(itemsOrUndefined(saved.inputItems)),
                edges: Array.isArray(saved.edges) ? saved.edges : [],
                finalItems: withUrls(itemsOrUndefined(saved.finalItems)),
                title: typeof saved.title === 'string' ? saved.title : undefined,
                finishedAt: typeof saved.finishedAt === 'number' ? saved.finishedAt : undefined
              });
              setImagesSaved(true);
            }
          } catch {
            // The browser database is unavailable: start fresh.
          }
        }
      }

      // Drop the list from the address so a refresh keeps later edits
      if (window.location.hash.includes('list=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setIsHydrating(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Save the session after every change
  useEffect(() => {
    if (isHydrating) return;

    if (state.listType === 'IMAGES') {
      // Object URLs die with the page, so only the ids and labels are saved
      // here; the pictures themselves live in the browser database.
      if (imagesSaved && state.status !== 'INPUT') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...state,
          items: withoutImageUrls(state.items),
          inputItems: withoutImageUrls(state.inputItems),
          finalItems: withoutImageUrls(state.finalItems)
        }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, imagesSaved, isHydrating]);

  // If the images could not be stored, at least warn before the page is left
  const imagesAtRisk = state.listType === 'IMAGES' && state.status !== 'INPUT' && !imagesSaved;
  useEffect(() => {
    if (!imagesAtRisk) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [imagesAtRisk]);

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

  const handleStart = (items: Item[], listType: ListType) => {
    // If user starts a new session, clear any pending undo functionality
    setShowUndoNav(false);
    setPreviousState(null);
    setIsSharedList(false);

    setImagesSaved(false);
    if (listType === 'IMAGES') {
      saveImages(items).then(() => setImagesSaved(true)).catch(() => setImagesSaved(false));
    } else {
      clearImages();
    }

    setState(prev => ({
      status: 'COMPARING',
      listType,
      // Asked in shuffled order so the questions do not follow the typed order...
      items: shuffle(items),
      // ...but the typed order is kept for going back to edit
      inputItems: items,
      edges: [],
      finalItems: undefined,
      // A custom title survives edits to the same list, not a different list
      title: sameItems(prev.inputItems, items) ? prev.title : undefined,
      // A friend's ranking stays for as long as the list still shares items with it
      theirRanking: listType === 'TEXT' && sharesItems(prev.theirRanking, items) ? prev.theirRanking : undefined
    }));
  };

  const handleDecision = (winner: Item, loser: Item) => {
    setState(prev => ({
      ...prev,
      edges: [...prev.edges, [winner.id, loser.id]]
    }));
  };

  // Take back the most recent answer; the comparison screen recomputes from the rest
  const handleUndoDecision = () => {
    setState(prev => ({ ...prev, edges: prev.edges.slice(0, -1) }));
  };

  // sortedItems is shorter than the full list when the user stopped at a Top N
  const handleComplete = (sortedItems: Item[]) => {
    setState(prev => ({ ...prev, status: 'RESULTS', finalItems: sortedItems, finishedAt: Date.now() }));
  };

  // Resume a ranking that was stopped at a Top N. The answers are still in
  // state, so it picks up at the next unanswered question.
  const handleContinue = () => {
    setState(prev => ({ ...prev, status: 'COMPARING', finalItems: undefined, finishedAt: undefined }));
  };

  // Reset completely to a new empty set
  const handleReset = () => {
    setState(INITIAL_STATE);
    setInputVersion(version => version + 1);
    setShowUndoNav(false);
    setPreviousState(null);
    setImagesSaved(false);
    clearImages();
  };

  // Restart ranking with the SAME items
  const handleRestart = () => {
    setState(prev => ({
      ...prev,
      status: 'COMPARING',
      // Always shuffle on restart to provide a fresh comparison path
      items: shuffle(prev.items),
      edges: [],
      finalItems: undefined,
      finishedAt: undefined
    }));
    setShowUndoNav(false);
    setPreviousState(null);
  };

  const handleTitleChange = (title: string | undefined) => {
    setState(prev => ({ ...prev, title }));
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
    // reducedMotion="user": people who ask their system for less motion get
    // fades instead of slides, scales and layout animations.
    <MotionConfig reducedMotion="user">
      <div className="h-[100dvh] w-full overflow-hidden bg-page font-sans antialiased text-ink">
        <Navbar
          onLogoClick={handleLogoClick}
          isLogoClickable={state.status !== 'INPUT'}
          showUndo={showUndoNav}
          onUndo={handleUndoNav}
          inverted={state.status === 'COMPARING' && !isHydrating}
        />
        {/* Screens handle their own padding to fit the fixed viewport and scroll internally */}
        <div className="h-full w-full">
          <AnimatePresence mode="wait">
            {!isHydrating && state.status === 'INPUT' && (
              <InputScreen
                key={`input-${inputVersion}`}
                onStart={handleStart}
                initialItems={state.inputItems ?? state.items}
                initialListType={state.listType}
                isSharedList={isSharedList}
                sharedWithRanking={!!state.theirRanking}
              />
            )}

            {!isHydrating && state.status === 'COMPARING' && (
              <ComparisonScreen
                key="comparing"
                items={state.items}
                edges={state.edges}
                onDecision={handleDecision}
                onUndo={handleUndoDecision}
                onComplete={handleComplete}
              />
            )}

            {!isHydrating && state.status === 'RESULTS' && (
              <ResultScreen
                key="results"
                items={state.finalItems ?? state.items}
                allItems={state.inputItems ?? state.items}
                totalCount={state.items.length}
                title={state.title}
                finishedAt={state.finishedAt}
                theirRanking={state.theirRanking}
                onTitleChange={handleTitleChange}
                onContinue={handleContinue}
                onReset={handleReset}
                onRestart={handleRestart}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </MotionConfig>
  );
}

export default App;
