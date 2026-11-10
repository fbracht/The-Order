# The Order

**The Order** ranks any list by asking you to pick between two items at a time. You never have to hold the whole list in your head: answer "this or that" until the app has enough to put everything in order.

Live at **https://fbracht.github.io/The-Order/**

It runs entirely in the browser. There is no server, no account, and nothing you enter leaves your device.

## What it does

- **Rank text or images.** Type or paste a list (one item per line), or add images from your device.
- **Forgiving input.** Pasted lists lose their numbering and bullets, a comma-separated line becomes one item per line, and repeated items can be removed with one tap.
- **As few questions as possible.** The ranking is a merge sort whose comparisons you answer. It never asks a question it could work out from your earlier answers.
- **Undo.** Take back any pick with the undo arrow, `Z` or `Backspace`, all the way to the first question.
- **Stop early with a Top N.** For lists of 30 items or more, places settle from first downward. The app says how many questions a Top 10 will take, and offers to stop when your Top 5, 10, 20, 25, 50 or 100 is settled. You can pick up where you left off later.
- **Share the result.** Save the ranking as a picture (or open the share sheet on a phone), copy it as text, or copy a link that opens the same list for someone else to rank.
- **Keeps your place.** A refresh brings back the list, your answers and the result. Images are kept in the browser's own database so image rankings survive a refresh too.
- **Light and dark.** Follows the system setting, and respects the reduced-motion setting.
- **Keyboard friendly.** `1` / `2` or the arrow keys to pick, and every control can be reached with `Tab`.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000/The-Order/
npm test         # unit tests
npm run build    # production build in dist/
npm run deploy   # test, build and publish dist/ to GitHub Pages
```

The dev server only listens on your own computer. To open it from a phone on the same network, run `npm run dev -- --host`.

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting notes.

## How it is built

React 19 and TypeScript, built with Vite. Styling is Tailwind CSS v4, compiled at build time. Animation is Framer Motion.

### The ranking engine (`utils/rankingEngine.ts`)

`getRankingState(items, answers)` is a pure function. It re-runs the sort from the start, answering each comparison from the recorded answers, and stops at the first one it cannot answer: that is the next question. Two things follow from this:

- **Undo** is removing the last answer and calling it again.
- **Resuming after a refresh** is calling it with the saved answers.

The same code runs in two question orders, at the same total cost:

- **Lists under 30 items** use the classic order: sort each half, then merge.
- **Lists of 30 or more** run lazily: each merge only does the work needed to produce its next-best item. First place is known after `n − 1` questions and each further place costs about `log2(n)` more, which is what makes the Top N possible.

The progress bar shows questions answered out of answered plus expected remaining, so it jumps forward when a pick lets the app place several items without asking.

### State (`App.tsx`)

One `RankingState` object holds the screen (`INPUT`, `COMPARING` or `RESULTS`), the list in both entered and shuffled order, the answers, the result and its title. It is saved to `localStorage` after every change.

Uploaded images are shown through object URLs, which stop working on reload. Their files are stored in IndexedDB (`utils/imageStore.ts`) and new URLs are made on the next visit. If the browser refuses to store them, the app warns before the page is closed instead.

### Sharing

- **Picture** (`utils/shareImage.ts`): the ranking is drawn directly on a canvas, so it needs no screenshot library and looks the same on every screen. Lists over 40 items are laid out in columns.
- **List link** (`utils/shareLink.ts`): the items are compressed into the part of the address after `#`, which browsers never send to a server.

### Design system (`index.css`)

Colours are named by role (`page`, `surface`, `ink`, `muted`, and so on) and have light and dark values, so screens never use fixed greys. The comparison screen is the exception: its black and white halves are the same in both modes. There are three shadow levels (`shadow-low`, `shadow-mid`, `shadow-high`); secondary buttons have none.

## File overview

- `App.tsx`: global state, saving and restoring, switching between screens.
- `screens/InputScreen.tsx`: the list box, image picker, validation and "Surprise Me".
- `screens/ComparisonScreen.tsx`: the two-panel choice, keyboard shortcuts, undo, the Top N offer and the progress bar.
- `screens/ResultScreen.tsx`: the result card, title editing and sharing.
- `components/`: `Button`, `Navbar`, and `SquircleContainer` (the smooth-cornered shape, drawn as an SVG path).
- `utils/rankingEngine.ts`: the sort described above. Tests in `rankingEngine.test.ts`.
- `utils/listInput.ts`: paste clean-up and duplicate handling.
- `utils/shareImage.ts`, `utils/shareLink.ts`, `utils/imageStore.ts`: see Sharing and State.
- `utils/presets.ts`: the "Surprise Me" lists. Add a list by adding an array of strings.
- `utils/security.ts`: length limits and input clean-up.

## Design notes

- **The pause at the end.** When the last question is answered, both panels turn into a checkmark for 0.8 seconds while the progress bar fills, before the result appears.
- **Surprise Me** only shows while the list is empty or still matches a preset, so it stays out of the way once you type your own.
- **Changed your mind?** Tapping the logo mid-ranking goes back to the list, and for four seconds an arrow in the corner takes you back to where you were.
- **An item stays on its side.** When the same item appears in two questions in a row, it keeps its place on screen.

## License

[MIT](LICENSE)
