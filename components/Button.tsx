import React from 'react';
import { SquircleContainer } from './SquircleContainer';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}) => {
  // Base button Reset
  const baseButtonStyles = "inline-flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed group relative bg-transparent border-0 p-0";

  // Content styling (Typography, Padding)
  // Note: Padding is applied inside the squircle container
  const contentStyles = "px-8 py-4 text-base font-bold uppercase tracking-wide flex items-center justify-center w-full h-full relative z-10";

  // Variant Mappings
  const variantConfig = {
    primary: {
      text: "text-white",
      bg: "text-black group-hover:text-gray-900 group-active:scale-95"
      // Using text- classes to control currentColor fill of the squircle
    },
    secondary: {
      text: "text-black",
      bg: "text-gray-100 group-hover:text-gray-200 group-active:scale-95"
    },
    ghost: {
      text: "text-gray-500 group-hover:text-black",
      bg: "text-transparent group-hover:text-gray-100/50"
    }
  };

  const config = variantConfig[variant];

  return (
    <button
      className={`
        ${baseButtonStyles} 
        ${fullWidth ? 'w-full' : ''} 
        ${className}
      `}
      {...props}
    >
      <SquircleContainer
        className="w-full h-full"
        bgClassName={`${config.bg} transition-all duration-200 ease-out`}
        cornerRadius={24} // Slightly rounder than a pure pill, but squircle
      // No explicit backgroundColor -> uses currentColor from bgClassName
      >
        <span className={`${contentStyles} ${config.text}`}>
          {children}
        </span>
      </SquircleContainer>
    </button>
  );
};