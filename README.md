# The Order

**The Order** is a premium ranking tool that uses transitive inference (Merge Sort logic) to help users prioritize lists with elegance and efficiency. Unlike a standard drag-and-drop list, this app forces the user to make binary choices ("A vs B"), drastically simplifying the cognitive load of ranking large sets.

## 🧠 Project Philosophy & Motivation

The original vision for this project was to create a ranking tool that feels less like a spreadsheet and more like a tactile, high-end experience.

### Core Motivations
1.  **Efficiency via Inference:** If a user prefers A > B and B > C, the app should automatically know that A > C. It uses a directed graph to track these relationships, minimizing the number of questions asked.
2.  **Aesthetics First:** The app relies on a "Swiss Design" aesthetic—clean typography (Inter), high contrast, ample whitespace, and subtle motion. It should feel native and polished on both mobile and desktop.
3.  **The "Receipt" Payoff:** The end result isn't just a list; it is presented as a physical, perforated receipt that can be customized and screenshot/shared.

### Specific Design Decisions
*   **The "Done" State:** When the ranking finishes, we deliberately avoid an immediate jump to the results. Instead, the comparison cards transform into a Checkmark Glyph (✅) for exactly **0.8 seconds**. This provides a moment of satisfaction and closure before the data is revealed.
*   **"Surprise Me" Logic:** To reduce clutter, the "Surprise Me" button (which loads presets like Beatles Albums or Ice Cream flavors) **only** appears if the input list is empty or matches an existing preset. If the user is typing their own list, this button fades away to avoid distraction.
*   **The "Take Me Back" Pattern:** The navigation allows for a temporary "Undo" state. If the user accidentally navigates away during a ranking session, they have a brief window to return to their previous state.

---

## 🛠 Technical Architecture

The app is built with **React (TypeScript)** and **Tailwind CSS**. It uses **Framer Motion** for all animations.

### 1. The Ranking Engine (`utils/rankingEngine.ts`)
This is the brain of the application.
*   **Algorithm:** It implements a generator-based Merge Sort.
*   **Transitive Inference:** Before asking the user to compare two items, it checks a `PreferenceGraph` (DAG). If a path exists between two items, it skips the question.
*   **Async Generator:** The sort logic yields `ComparisonPair` objects to the UI and waits for a Promise resolution (`LEFT` or `RIGHT`) before continuing.

### 2. State Management (`App.tsx`)
The app moves through three distinct phases:
1.  **INPUT:** User enters raw text (newline separated).
2.  **COMPARING:** The interactive phase using the Ranking Engine.
3.  **RESULTS:** The final sorted display.

*Data Persistence:* State is saved to `localStorage` to prevent data loss on refresh.

### 3. Screen Capture (`screens/ResultScreen.tsx`)
We use `html2canvas` to generate shareable images.
*   **Note:** The capture logic creates a temporary, off-screen DOM element with fixed dimensions (iPhone 14 Pro width) and a scale factor of 3 to ensure high-resolution, consistent exports regardless of the user's actual screen size.

---

## 📂 File Structure Overview

*   **`App.tsx`**: Main entry point, handles global state, routing, and the "Undo" timer.
*   **`screens/`**:
    *   `InputScreen.tsx`: Text area input. Contains logic for the "Surprise Me" button and input validation/sanitization.
    *   `ComparisonScreen.tsx`: The binary choice UI. Handles keyboard shortcuts (1/2, Arrow Keys) and the "Checkmark" animation.
    *   `ResultScreen.tsx`: The visual "receipt." Handles title editing and image generation.
*   **`utils/`**:
    *   `rankingEngine.ts`: The logic for sorting and graph traversal.
    *   `presets.ts`: Static lists used for the "Surprise Me" feature.
    *   `security.ts`: Input sanitization (XSS prevention, length limits).
*   **`components/`**:
    *   `Button.tsx`: Reusable button component with variants.
    *   `Navbar.tsx`: Top navigation bar.

---

## 🚀 For the Next Developer

*   **Styling:** We use standard Tailwind classes. Note the specific color palette: backgrounds are usually `#F5F5F7` (Apple-style gray), text is `#1D1D1F`.
*   **Animations:** `AnimatePresence` is used heavily for page transitions. Be careful when modifying the key props on `motion.div` elements to ensure exit animations play correctly.
*   **Responsiveness:** The app works in landscape and portrait. `ComparisonScreen.tsx` has specific logic to switch layout orientation based on the device aspect ratio.
*   **Presets:** If you want to add more "Surprise Me" options, simply add string arrays to `utils/presets.ts`.

Enjoy keeping The Order.
