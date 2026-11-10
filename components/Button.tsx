import React from 'react';
import { SquircleContainer } from './SquircleContainer';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  className = '',
  ...props
}) => {
  // The focus ring only shows for keyboard focus, and is rounded like the button
  const baseButtonStyles = "inline-flex items-center justify-center transition-all duration-200 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:opacity-50 disabled:cursor-not-allowed group relative bg-transparent border-0 p-0";

  // Padding is applied inside the squircle container
  const contentStyles = "px-6 py-4 text-base font-bold uppercase tracking-wide flex items-center justify-center w-full h-full relative z-10";

  // The squircle is filled with currentColor, so its colour is set with text- classes.
  // Only the primary button casts a shadow.
  const variantConfig = {
    primary: {
      text: "text-on-ink",
      bg: "text-ink group-hover:opacity-85 group-active:scale-95",
      shadow: 'mid' as const
    },
    secondary: {
      text: "text-ink",
      bg: "text-chip group-hover:brightness-95 group-active:scale-95",
      shadow: 'none' as const
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
        shadow={config.shadow}
      >
        <span className={`${contentStyles} ${config.text}`}>
          {children}
        </span>
      </SquircleContainer>
    </button>
  );
};
