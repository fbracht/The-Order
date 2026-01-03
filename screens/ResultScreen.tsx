import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../types';
import { Button } from '../components/Button';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { sanitizeString, MAX_TITLE_LENGTH } from '../utils/security';

interface ResultScreenProps {
  items: Item[]; // Assumed sorted
  onReset: () => void;
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ items, onReset, onRestart }) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [title, setTitle] = useState("Your Ranking");
  const [isEditing, setIsEditing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Capture date once on mount
  const [dateString] = useState(() => {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${date} • ${time}`;
  });

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  const handleTitleSubmit = () => {
    setIsEditing(false);

    // Sanitize title on submit
    const cleanTitle = sanitizeString(title, MAX_TITLE_LENGTH);

    if (cleanTitle === "") {
      setTitle("Your Ranking");
    } else {
      setTitle(cleanTitle);
    }
  };

  const handleSaveScreenshot = async () => {
    setIsCapturing(true);
    setIsEditing(false); // Ensure edit mode is off

    try {
      // Create a dedicated container for the screenshot to ensure correct dimensions/styling
      // Logic: 
      // 1. Create a container with fixed width 393px (iPhone 14 Pro width).
      // 2. Use auto height to fit content exactly + padding.
      // 3. Render scale: 3 (High DPI output).

      const container = document.createElement('div');
      container.style.width = '393px';
      // Removed fixed min-height to avoid excessive vertical whitespace
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.backgroundColor = '#F5F5F7';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      // container.style.justifyContent = 'center'; // Removed to let content dictate height
      container.style.padding = '40px 20px';
      container.style.boxSizing = 'border-box';
      container.style.fontFamily = 'Inter, sans-serif';

      // Clone the card content
      const originalCard = document.querySelector('.print-content');
      if (!originalCard) {
        throw new Error("Could not find content to capture");
      }

      const cardClone = originalCard.cloneNode(true) as HTMLElement;

      // Reset animations/transforms on clone
      cardClone.style.transform = 'none';
      cardClone.style.opacity = '1';
      cardClone.style.width = '100%';
      cardClone.style.maxWidth = '100%';
      cardClone.style.margin = '0';
      // Ensure shadow and border look good at this scale
      cardClone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.05)';

      // Fix borders for clone: remove top border to match the perforated style
      cardClone.style.borderLeft = '1px solid rgba(255,255,255,0.8)';
      cardClone.style.borderRight = '1px solid rgba(255,255,255,0.8)';
      cardClone.style.borderBottom = '1px solid rgba(255,255,255,0.8)';
      cardClone.style.borderTop = 'none';

      // Recreate the perforated edge decoration for the clone
      // html2canvas doesn't reliably clone CSS background patterns, so we'll create it programmatically
      const perforatedEdge = cardClone.querySelector('.absolute.top-0') as HTMLElement;
      if (perforatedEdge) {
        // Clear the existing content and recreate with explicit elements
        perforatedEdge.innerHTML = '';
        perforatedEdge.style.position = 'absolute';
        perforatedEdge.style.top = '0';
        perforatedEdge.style.left = '0';
        perforatedEdge.style.right = '0';
        perforatedEdge.style.height = '16px';
        perforatedEdge.style.zIndex = '20';
        perforatedEdge.style.pointerEvents = 'none';
        perforatedEdge.style.overflow = 'hidden';

        // Create individual semicircle cutouts across the width
        // Card width is 393px (container width), spacing is 24px between centers
        const cardWidth = 393;
        const spacing = 24;
        const circleRadius = 8;
        const numCircles = Math.ceil(cardWidth / spacing) + 1;

        for (let i = 0; i < numCircles; i++) {
          const circle = document.createElement('div');
          circle.style.position = 'absolute';
          circle.style.top = `-${circleRadius}px`; // Position so only bottom half is visible
          circle.style.left = `${i * spacing - circleRadius}px`;
          circle.style.width = `${circleRadius * 2}px`;
          circle.style.height = `${circleRadius * 2}px`;
          circle.style.borderRadius = '50%';
          circle.style.backgroundColor = '#F5F5F7'; // Match background color
          perforatedEdge.appendChild(circle);
        }
      }

      // --- DENSITY ADJUSTMENTS FOR SCREENSHOT ---
      // Apply compact styles directly to the clone elements

      // 1. Compact Main Padding
      const contentDiv = cardClone.querySelector('.p-8') as HTMLElement;
      if (contentDiv) {
        contentDiv.classList.remove('p-8', 'sm:p-12');
        contentDiv.style.padding = '32px 28px'; // Tighter padding
      }

      // 2. Compact Header
      const header = cardClone.querySelector('header');
      if (header) {
        header.classList.remove('mb-12', 'pb-8');
        header.style.marginBottom = '20px';
        header.style.paddingBottom = '16px';

        // Smaller Title
        const h1 = header.querySelector('h1');
        if (h1) {
          h1.classList.remove('text-3xl');
          h1.style.fontSize = '24px';
        }
      }

      // 3. Compact List Items
      const listItems = cardClone.querySelectorAll('li');
      listItems.forEach((li) => {
        li.classList.remove('py-4');
        li.style.paddingTop = '8px';
        li.style.paddingBottom = '8px';

        const rankSpan = li.children[0] as HTMLElement;
        const textSpan = li.children[1] as HTMLElement;

        // Compact Rank Number
        if (rankSpan) {
          rankSpan.classList.remove('w-12', 'text-lg', 'text-base', 'text-sm');
          rankSpan.style.width = '28px';
          rankSpan.style.fontSize = '12px';
        }

        // Compact Text Size
        if (textSpan) {
          if (textSpan.classList.contains('text-3xl')) {
            textSpan.classList.remove('text-3xl');
            textSpan.style.fontSize = '20px';
          } else if (textSpan.classList.contains('text-2xl')) {
            textSpan.classList.remove('text-2xl');
            textSpan.style.fontSize = '18px';
          } else if (textSpan.classList.contains('text-xl')) {
            textSpan.classList.remove('text-xl');
            textSpan.style.fontSize = '17px';
          } else {
            textSpan.classList.remove('text-lg');
            textSpan.style.fontSize = '14px';
          }
        }
      });

      // 4. Compact Footer
      const footerElement = cardClone.querySelector('.mt-12');
      if (footerElement) {
        footerElement.classList.remove('mt-12', 'pt-8');
        (footerElement as HTMLElement).style.marginTop = '24px';
        (footerElement as HTMLElement).style.paddingTop = '16px';
      }

      // 5. Smaller Tagline ("ORDERED ON [DATE]")
      const tagline = cardClone.querySelector('header p');
      if (tagline) {
        tagline.classList.remove('text-sm');
        (tagline as HTMLElement).style.fontSize = '10px';
      }

      // Ensure the footer (Generated by) is visible in clone if it was hidden
      const footer = cardClone.querySelector('.hidden.print\\:flex');
      if (footer) {
        footer.classList.remove('hidden', 'print:flex');
        footer.classList.add('flex');
      }

      // Hide the pencil icon in the screenshot if it exists
      const pencilBtn = cardClone.querySelector('.edit-btn');
      if (pencilBtn) {
        (pencilBtn as HTMLElement).style.display = 'none';
      }

      container.appendChild(cardClone);
      document.body.appendChild(container);

      // Force layout calculation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture
      const canvas = await html2canvas(container, {
        scale: 3, // High resolution (3x logical pixels = ~1179px width)
        useCORS: true,
        backgroundColor: '#F5F5F7',
        logging: false,
        windowWidth: 393,
        onclone: (clonedDoc) => {
          // Additional tweaks if needed inside the cloned document context
        }
      });

      // Clean up
      document.body.removeChild(container);

      // Download
      // Ensure we're using the current title value (not a stale closure)
      const currentTitle = title || "Your Ranking";
      const safeTitle = currentTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dateString = new Date().toISOString().slice(0, 10);
      const filename = `TheOrder-${safeTitle}-${dateString}.png`;

      // Convert canvas to blob for better browser compatibility (especially Chrome)
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Failed to create image blob");
        }

        // Create object URL from blob (more reliable than data URL in Chrome)
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        // Trigger download
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 'image/png');

    } catch (err) {
      console.error("Screenshot failed", err);
      alert("Failed to create screenshot. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    // h-full and overflow-y-auto enable internal scrolling within the fixed viewport
    // pt-36 ensures content starts comfortably below the floating navbar (consistent with InputScreen)
    <div className="h-full overflow-y-auto bg-[#F5F5F7] pt-36 pb-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">

      {/* Main Content Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        // Removed rounded-3xl from top, kept on bottom. Added rounded-t-sm.
        // Modified border to exclude top to allow the "tear" effect to look clean.
        className="print-content w-full max-w-2xl bg-white rounded-t-sm rounded-b-3xl shadow-lg sm:shadow-2xl sm:shadow-black/[0.03] overflow-hidden border-x border-b border-white/50 border-t-0 relative flex-shrink-0"
      >
        {/* 
            Perforated Top Edge Decoration 
            Simulates a page torn from a spiral notebook.
        */}
        <div className="absolute top-0 left-0 right-0 h-4 z-20 pointer-events-none">
          {/* The "holes" overlay - using the background color #F5F5F7 to mask the white card */}
          <div className="w-full h-full"
            style={{
              // Circle centered at top edge (0), radius 8px (16px diameter).
              // Spacing 24px (leaves ~8px of paper between holes).
              backgroundImage: 'radial-gradient(circle at 50% 0, #F5F5F7 8px, transparent 8.5px)',
              backgroundSize: '24px 24px',
              backgroundRepeat: 'repeat-x'
            }}
          />
        </div>

        <div className="p-8 sm:p-12 relative pt-12">
          {/* Header with Editable Title */}
          <header className="mb-12 text-left border-b border-gray-100 pb-8 relative z-10">
            <div className="mb-2 group relative">
              {isEditing ? (
                <input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                  className="text-3xl font-semibold text-[#1D1D1F] tracking-tight bg-transparent border-none outline-none p-0 w-full placeholder-gray-300"
                  placeholder="Name your list..."
                  maxLength={MAX_TITLE_LENGTH}
                />
              ) : (
                <h1
                  onClick={() => setIsEditing(true)}
                  // Added text-balance to help with wrapping aesthetics
                  className="text-3xl font-semibold text-[#1D1D1F] tracking-tight cursor-text text-balance block"
                >
                  {/* Prevent orphan words by gluing the last two words with a non-breaking space */}
                  {title.includes(' ') ? (
                    <>
                      {title.slice(0, title.lastIndexOf(' '))}
                      &nbsp;
                      {title.slice(title.lastIndexOf(' ') + 1)}
                    </>
                  ) : title}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="edit-btn inline-flex align-baseline ml-2 text-gray-300 hover:text-gray-500 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1"
                    aria-label="Edit title"
                    style={{ verticalAlign: 'middle', transform: 'translateY(-2px)' }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </h1>
              )}
            </div>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
              Ordered on {dateString}
            </p>
          </header>

          <ol className="list-none relative z-10">
            {items.map((item, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              // Uniform spacing for all items
              let containerClasses = "py-4 border-b border-gray-100";

              // Consistent line-height logic
              const baseTextClasses = "leading-tight tracking-tight";

              // Dynamic styles based on rank
              let numberClasses = "text-gray-300 font-mono text-sm";
              let textClasses = `text-lg text-gray-600 font-medium ${baseTextClasses}`;

              // Dashed border for non-podium items
              if (!isFirst && !isSecond && !isThird) {
                containerClasses = "py-4 border-b border-dashed border-gray-100";
              }

              if (isFirst) {
                numberClasses = "text-amber-500 font-bold text-lg font-sans"; // Gold
                textClasses = `text-3xl text-[#1D1D1F] font-bold ${baseTextClasses}`;
              } else if (isSecond) {
                // Slate-500 offers a 'cooler' silver tone distinct from the warm gray-300 default
                numberClasses = "text-slate-500 font-semibold text-base font-sans";
                textClasses = `text-2xl text-[#1D1D1F] font-semibold ${baseTextClasses}`;
              } else if (isThird) {
                numberClasses = "text-orange-700/80 font-medium text-base font-sans"; // Bronze
                textClasses = `text-xl text-[#1D1D1F] font-medium ${baseTextClasses}`;
              }

              return (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + (index * 0.05), duration: 0.5, ease: "easeOut" }}
                  // Changed rounded-lg to rounded-xl
                  className={`group flex items-baseline hover:bg-gray-50/50 transition-colors px-3 -mx-3 rounded-xl last:border-0 ${containerClasses}`}
                >
                  <span className={`flex-shrink-0 w-12 select-none group-hover:text-gray-900 transition-colors ${numberClasses}`}>
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <span className={`flex-1 ${textClasses}`}>
                    {item}
                  </span>
                </motion.li>
              );
            })}
          </ol>

          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-between items-center text-xs text-gray-300 font-mono hidden print:flex relative z-10">
            <span>Generated by The Order</span>
            <span>the-order.app</span>
          </div>
        </div>
      </motion.div>

      {/* Action Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="no-print mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl flex-shrink-0 pb-safe"
      >
        <Button onClick={onReset} variant="secondary" className="w-full">
          New Set
        </Button>
        <Button onClick={onRestart} variant="secondary" className="w-full">
          Re-order Set
        </Button>
        <Button
          onClick={handleSaveScreenshot}
          variant="primary"
          className="w-full relative overflow-hidden"
          disabled={isCapturing}
        >
          {isCapturing ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Processing...
            </span>
          ) : (
            "Save Screenshot"
          )}
        </Button>
      </motion.div>

    </div>
  );
};