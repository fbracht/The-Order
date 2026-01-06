import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../types';
import { Button } from '../components/Button';
import { SquircleContainer } from '../components/SquircleContainer';
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
      // Create a dedicated container for the screenshot
      // Standard mobile width for consistent output
      const container = document.createElement('div');
      container.style.width = '393px';
      container.style.position = 'absolute';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.backgroundColor = '#F5F5F7'; // App background color
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.padding = '40px 20px';
      container.style.boxSizing = 'border-box';
      container.style.fontFamily = 'Outfit, sans-serif'; // Enforce Outfit

      // Clone the card content (Extracting ONLY inner content for clean export)
      const originalCard = document.querySelector('.print-content');
      if (!originalCard) {
        throw new Error("Could not find content to capture");
      }

      const contentSource = originalCard.querySelector('.p-8');
      if (!contentSource) throw new Error("Could not find inner content");

      // Create a clean Card Wrapper to replace the Squircle/Motion wrappers
      const cardWrapper = document.createElement('div');
      cardWrapper.style.width = '100%';
      cardWrapper.style.backgroundColor = '#000000';
      cardWrapper.style.color = '#FFFFFF';
      cardWrapper.style.borderRadius = '40px';
      cardWrapper.style.overflow = 'hidden';
      cardWrapper.style.position = 'relative';
      cardWrapper.style.boxShadow = '0 20px 40px -10px rgba(0,0,0,0.3)';

      // Clone content and append
      const contentClone = contentSource.cloneNode(true) as HTMLElement;


      // Reset content padding/margin for the mobile width
      contentClone.style.margin = '0';
      contentClone.style.padding = '32px 24px'; // Tighter padding for image

      // Fix visual quirks in clone
      // 1. Footer visibility
      const footer = contentClone.querySelector('.hidden.print\\:flex');
      if (footer) {
        footer.classList.remove('hidden', 'print:flex');
        footer.classList.add('flex');
      }

      // 2. Hide Edit Pencil
      const pencilBtn = contentClone.querySelector('.edit-btn');
      if (pencilBtn) (pencilBtn as HTMLElement).style.display = 'none';

      // 3. Spacing adjustments for dense list
      const listItems = contentClone.querySelectorAll('li');
      listItems.forEach((li) => {
        (li as HTMLElement).style.paddingTop = '12px';
        (li as HTMLElement).style.paddingBottom = '12px';
      });

      cardWrapper.appendChild(contentClone);
      container.appendChild(cardWrapper);
      document.body.appendChild(container);

      // Force layout calculation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture
      const canvas = await html2canvas(container, {
        scale: 3, // High resolution
        useCORS: true,
        backgroundColor: '#F5F5F7',
        logging: false,
        windowWidth: 393,
        onclone: (clonedDoc) => {
          // Inject font face if needed, but usually works if loaded in main doc
        }
      });

      // Clean up
      document.body.removeChild(container);

      // Download
      const currentTitle = title || "Your Ranking";
      const safeTitle = currentTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const dateString = new Date().toISOString().slice(0, 10);
      const filename = `TheOrder-${safeTitle}-${dateString}.png`;

      canvas.toBlob((blob) => {
        if (!blob) throw new Error("Failed to create image blob");
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
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
    <div className="h-full overflow-y-auto bg-[#F5F5F7] pt-32 pb-12 px-4 flex flex-col items-center">

      {/* Main Content Card - Dark Mode for Results */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="print-content w-full max-w-xl flex-shrink-0"
      >
        <SquircleContainer
          className="w-full text-white"
          backgroundColor="black"
          cornerRadius={60} // Generous smooth radius
        >
          <div className="p-8 sm:p-10 relative">
            {/* Header with Editable Title */}
            <header className="mb-10 text-left border-b border-white/10 pb-6 relative z-10">
              <div className="mb-1 group relative">
                {isEditing ? (
                  <input
                    ref={titleInputRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                    className="text-4xl font-extrabold tracking-tight bg-transparent border-none outline-none p-0 w-full placeholder-gray-600 text-white selection:bg-white/30"
                    placeholder="Name your list..."
                    maxLength={MAX_TITLE_LENGTH}
                  />
                ) : (
                  <h1
                    onClick={() => setIsEditing(true)}
                    className="text-4xl font-extrabold tracking-tight cursor-text text-balance block text-white"
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
                      className="edit-btn inline-flex align-baseline ml-3 text-white/20 hover:text-white/60 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 p-1"
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
              <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">
                RANKED ON {dateString}
              </p>
            </header>

            <ol className="list-none relative z-10 space-y-2">
              {items.map((item, index) => {
                const isFirst = index === 0;
                const isSecond = index === 1;
                const isThird = index === 2;

                // Ranks visuals
                let rankColor = "text-gray-500";
                let textColor = "text-gray-300";
                let rowBg = "bg-white/5";

                if (isFirst) {
                  rankColor = "text-yellow-400";
                  textColor = "text-white";
                  rowBg = "bg-white/10";
                } else if (isSecond) {
                  rankColor = "text-gray-300";
                  textColor = "text-white";
                } else if (isThird) {
                  rankColor = "text-orange-400";
                  textColor = "text-white";
                }

                return (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + (index * 0.05), duration: 0.4 }}
                    className={`group flex items-center px-4 py-3 rounded-2xl ${rowBg} hover:bg-white/15 transition-colors`}
                  >
                    <span className={`w-8 font-mono text-sm font-bold ${rankColor}`}>
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <span className={`flex-1 text-lg font-semibold tracking-tight ${textColor}`}>
                      {item}
                    </span>
                  </motion.li>
                );
              })}
            </ol>

            <div className="mt-12 pt-6 border-t border-white/10 flex justify-center items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden print:flex relative z-10">
              <span>GENERATED BY THE ORDER APP</span>
            </div>
          </div>
        </SquircleContainer>
      </motion.div>

      {/* Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="no-print mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xl flex-shrink-0"
      >
        <div className='flex gap-2 flex-1'>
          <Button onClick={onReset} variant="secondary" className="flex-1">
            New
          </Button>
          <Button onClick={onRestart} variant="secondary" className="flex-1">
            Retry
          </Button>
        </div>

        <Button
          onClick={handleSaveScreenshot}
          variant="primary"
          className="flex-[2]"
          disabled={isCapturing}
        >
          {isCapturing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              Exporting...
            </span>
          ) : (
            "Save Image"
          )}
        </Button>
      </motion.div>

    </div>
  );
};