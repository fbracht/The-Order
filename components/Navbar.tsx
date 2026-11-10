import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  onLogoClick?: () => void;
  isLogoClickable?: boolean;
  showUndo?: boolean;
  onUndo?: () => void;
  inverted?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLogoClick,
  isLogoClickable = false,
  showUndo = false,
  onUndo,
  inverted = false
}) => {
  const LogoWrapper = (isLogoClickable ? 'button' : 'div') as React.ElementType;
  // On the comparison screen the logo sits on fixed black and white panels;
  // everywhere else it follows the light or dark palette.
  const shape = inverted ? 'white' : 'var(--color-ink)';
  const glyph = inverted ? 'black' : 'var(--color-on-ink)';
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-24 pointer-events-none">
      {/* 
        Centering Logic:
        We want the SEPARATOR line to be exactly at the center of the screen.
        The layout is: [Icon 48px] [Gap 16px] [Separator 2px] [Gap 16px] [Text ...]
        
        Distance from Left Edge to Center of Separator:
        48 (Icon) + 16 (Gap) + 1 (Half Separator) = 65px.
        
        So we position the container at left-1/2 and translate it back by 65px.
      */}
      <div
        className="absolute top-6 left-1/2 pointer-events-auto"
        style={{ transform: 'translateX(-51%)' }}
      >
        {/* A real button while it leads somewhere, so it can be reached with Tab */}
        <LogoWrapper
          {...(isLogoClickable
            ? { type: 'button', onClick: onLogoClick, 'aria-label': 'The Order: back to your list' }
            : { 'aria-label': 'The Order', role: 'img' })}
          className={`group flex items-center select-none rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-4 ${inverted ? 'focus-visible:ring-gray-400 focus-visible:ring-offset-transparent' : 'focus-visible:ring-ink focus-visible:ring-offset-page'}`}
        >
          {/* 
            Balanced Layout:
            We use a fixed width for both left (icon) and right (text) sides to ensure
            the separator (in the middle) is perfectly centered on the screen.
            
            Side Width: Adjusted to 100px for larger typography.
          */}

          {/* LEFT SIDE: ICON (Aligned Right) */}
          <div className="w-[100px] flex justify-end pr-5">
            <svg width="64" height="64" viewBox="0 0 80 80" fill="none" className="transform transition-transform group-hover:scale-105">
              <path
                d="M 40 5 
                       C 65 5, 75 15, 75 40 
                       C 75 65, 65 75, 40 75 
                       C 15 75, 5 65, 5 40 
                       C 5 15, 15 5, 40 5 
                       Z"
                fill={shape}
                className="transition-colors duration-300"
              />
              <path d="M30 38 L40 24 L50 38 H46 V44 H34 V38 H30 Z" fill={glyph} className="transition-colors duration-300" />
              <path d="M30 42 L40 56 L50 42 H46 V36 H34 V36 H30 Z" fill={glyph} className="transition-colors duration-300" />
              <rect x="28" y="38" width="24" height="4" fill={shape} className="transition-colors duration-300" />
            </svg>
          </div>

          {/* CENTER: SEPARATOR */}
          {/* While comparing in portrait the lockup sits on the black top panel, so it flips to white.
              In landscape the seam runs through the separator and the wordmark stays on the white side. */}
          <div className={`h-12 w-0.5 opacity-50 relative rounded-full transition-colors duration-300 ${inverted ? 'bg-black portrait:bg-white' : 'bg-ink'}`}></div>

          {/* RIGHT SIDE: TEXT (Aligned Left) */}
          <div className={`w-[100px] flex justify-start pl-5 transition-colors duration-300 text-left ${inverted ? 'text-black portrait:text-white' : 'text-ink'}`}>
            <div className="flex flex-col justify-center leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <span className="text-sm font-bold tracking-widest uppercase opacity-60 -mb-1" style={{ marginLeft: '1px' }}>The</span>
              <span className="text-[27px] font-extrabold tracking-tight uppercase leading-[0.9]">Order</span>
            </div>
          </div>

        </LogoWrapper>
      </div>

      {/* Undo Button - Absolute Right */}
      <div className="absolute top-6 right-6 pointer-events-auto">
        <AnimatePresence>
          {showUndo && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              type="button"
              onClick={onUndo}
              aria-label="Go back to where you were"
              title="Go back to where you were"
              className="w-11 h-11 bg-surface shadow-mid rounded-full flex items-center justify-center text-ink hover:scale-105 transition-transform"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};