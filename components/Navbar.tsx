import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavbarProps {
  onLogoClick?: () => void;
  isLogoClickable?: boolean;
  showUndo?: boolean;
  onUndo?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  onLogoClick, 
  isLogoClickable = false, 
  showUndo = false, 
  onUndo 
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4 pointer-events-none">
      <nav className="pointer-events-auto w-full max-w-2xl h-14 bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_12px_32px_rgba(0,0,0,0.12)] rounded-full flex items-center justify-between px-6 transition-all duration-300">
        <div 
          onClick={isLogoClickable ? onLogoClick : undefined}
          className={`flex items-center gap-3 transition-opacity ${isLogoClickable ? 'cursor-pointer hover:opacity-60 active:opacity-40' : ''}`}
          role={isLogoClickable ? "button" : undefined}
          aria-label={isLogoClickable ? "Return to input" : "The Order"}
        >
          {/* Logo Icon (Abstract lines representing order) */}
          <div className="w-5 h-5 flex flex-col justify-center gap-1 opacity-80">
            <div className="w-full h-0.5 bg-[#1D1D1F] rounded-full"></div>
            <div className="w-3/4 h-0.5 bg-[#1D1D1F] rounded-full"></div>
            <div className="w-1/2 h-0.5 bg-[#1D1D1F] rounded-full"></div>
          </div>
          <span className="text-lg font-semibold tracking-tight text-[#1D1D1F]">The Order</span>
        </div>
        
        <div className="flex items-center gap-4 h-full min-w-[80px] justify-end">
          <AnimatePresence>
            {showUndo && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, transition: { duration: 0.5 } }}
                onClick={onUndo}
                className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                Take me back!
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </div>
  );
};