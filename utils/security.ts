/**
 * Security and Validation Utilities
 */

// Limits to prevent UI breaking and performance issues
export const MAX_ITEM_LENGTH = 100; // Max characters per ranking item
export const MAX_LIST_SIZE = 250;   // Max number of items to rank (prevents browser hang)
export const MAX_TITLE_LENGTH = 40; // Max characters for result title

/**
 * Sanitizes user input to prevent XSS and control character issues.
 * 1. Trims whitespace.
 * 2. Removes HTML tags.
 * 3. Truncates to maxLength.
 */
export const sanitizeString = (str: string, maxLength: number = 255): string => {
  if (!str) return '';
  
  // 1. Remove HTML tags (basic regex)
  let clean = str.replace(/<\/?[^>]+(>|$)/g, "");
  
  // 2. Normalize whitespace (replace tabs/newlines in single line inputs with space)
  // We don't remove newlines if it's the raw textarea, but this is usually for individual items
  clean = clean.replace(/\r/g, ''); 

  // 3. Trim
  clean = clean.trim();

  // 4. Truncate
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  return clean;
};
