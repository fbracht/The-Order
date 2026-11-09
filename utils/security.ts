/**
 * Security and Validation Utilities
 */

// Limits to prevent UI breaking and performance issues
export const MAX_ITEM_LENGTH = 100; // Max characters per ranking item
export const MAX_LIST_SIZE = 250;   // Max number of items to rank (prevents browser hang)
export const MAX_TITLE_LENGTH = 40; // Max characters for result title

/**
 * Cleans one line of user input: drops control characters, trims, and
 * truncates to maxLength.
 *
 * It deliberately does not strip "<" or ">". React escapes everything it
 * renders, so text like "I <3 pizza" or "Mario < Luigi" is safe to keep.
 */
export const sanitizeString = (str: string, maxLength: number = 255): string => {
  if (!str) return '';
  
  // 1. Drop control characters (carriage returns, stray tabs, etc.)
  let clean = str.replace(/[\u0000-\u001F\u007F]/g, ' ');

  // 2. Trim
  clean = clean.trim();

  // 3. Truncate
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  return clean;
};
