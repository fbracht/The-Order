import { Item } from '../types';

/**
 * Draws a finished ranking as a picture, for saving or sharing.
 *
 * The picture is drawn directly on a canvas instead of photographing the
 * page: that needs no extra library, always looks the same whatever the
 * screen size, and uploaded images can be included because they are local.
 */

export interface ShareImageInput {
  title: string;
  /** The small line under the title, for example "RANKED ON 9 NOVEMBER 2026". */
  subtitle: string;
  items: Item[];
  /** Shown at the bottom, for example the site address. */
  footer: string;
}

const SANS = 'Outfit, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const PAD = 72;
const SINGLE_WIDTH = 1080;
// Longer lists are laid out in columns so the picture stays a usable shape
const MAX_SINGLE_COLUMN = 40;
const COLUMN_WIDTH = 600;
const COLUMN_GAP = 24;
const ROW_GAP = 12;

const RANK_COLORS = ['#FACC15', '#D1D5DB', '#FB923C'];

const font = (weight: number, size: number, family = SANS) => `${weight} ${size}px ${family}`;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Breaks text into lines that fit maxWidth, cutting the last allowed line with an ellipsis. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const fits = (candidate: string) => ctx.measureText(candidate).width <= maxWidth;
  const lines: string[] = [];
  let current = '';

  const pushWord = (word: string) => {
    // A single word wider than the line is broken by character
    let rest = word;
    while (!fits(rest) && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = '';
      pushWord(word);
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines.length > 0 ? lines : [''];
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Draws an image cropped to fill a rounded square, like CSS object-fit: cover. */
function drawThumb(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, size: number, radius: number) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.save();
  roundedRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
  ctx.restore();
}

interface RowStyle {
  labelSize: number;
  labelWeight: number;
  labelColor: string;
  rankSize: number;
  rankColor: string;
  padY: number;
  thumb: number;
  background: string;
  maxLines: number;
}

function rowStyle(index: number, compact: boolean): RowStyle {
  const rankColor = RANK_COLORS[index] ?? '#9CA3AF';
  if (compact) {
    return { labelSize: 26, labelWeight: 600, labelColor: index < 3 ? '#FFFFFF' : '#D1D5DB', rankSize: 20, rankColor, padY: 16, thumb: 40, background: 'rgba(255,255,255,0.06)', maxLines: 1 };
  }
  if (index === 0) {
    return { labelSize: 46, labelWeight: 800, labelColor: '#FFFFFF', rankSize: 30, rankColor, padY: 36, thumb: 150, background: 'rgba(255,255,255,0.12)', maxLines: 3 };
  }
  if (index < 3) {
    return { labelSize: 38, labelWeight: 700, labelColor: '#FFFFFF', rankSize: 24, rankColor, padY: 30, thumb: 104, background: 'rgba(255,255,255,0.06)', maxLines: 3 };
  }
  return { labelSize: 32, labelWeight: 600, labelColor: '#D1D5DB', rankSize: 24, rankColor, padY: 24, thumb: 72, background: 'rgba(255,255,255,0.06)', maxLines: 3 };
}

export async function renderRankingImage({ title, subtitle, items, footer }: ShareImageInput): Promise<HTMLCanvasElement> {
  // Canvas text falls back silently to a system font unless the web font is ready
  if (document.fonts?.load) {
    await Promise.all([600, 700, 800].map(weight => document.fonts.load(font(weight, 40))));
  }
  const images = await Promise.all(items.map(item => (item.imageUrl ? loadImage(item.imageUrl) : Promise.resolve(null))));
  const hasImages = images.some(Boolean);

  const compact = items.length > MAX_SINGLE_COLUMN;
  const columns = compact ? Math.ceil(items.length / MAX_SINGLE_COLUMN) : 1;
  const perColumn = Math.ceil(items.length / columns);
  const width = compact ? PAD * 2 + columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP : SINGLE_WIDTH;
  const columnWidth = compact ? COLUMN_WIDTH : width - PAD * 2;

  // Text can only be measured with a canvas, so lay everything out first on a
  // scratch one, then size the real canvas to fit.
  const measure = document.createElement('canvas').getContext('2d')!;

  const titleSize = 76;
  measure.font = font(800, titleSize);
  const titleLines = wrapText(measure, title, width - PAD * 2, 3);

  const rankWidth = compact ? 52 : 68;
  const rowPadX = compact ? 20 : 30;
  const rows = items.map((item, index) => {
    const style = rowStyle(index, compact);
    const thumb = hasImages ? style.thumb : 0;
    const textWidth = columnWidth - rowPadX * 2 - rankWidth - (thumb ? thumb + 20 : 0);
    measure.font = font(style.labelWeight, style.labelSize);
    const lines = wrapText(measure, item.label, textWidth, style.maxLines);
    const lineHeight = Math.round(style.labelSize * 1.2);
    const height = Math.max(lines.length * lineHeight, thumb) + style.padY * 2;
    return { item, index, style, thumb, lines, lineHeight, height };
  });

  const columnHeights = Array.from({ length: columns }, (_, column) =>
    rows.slice(column * perColumn, (column + 1) * perColumn).reduce((sum, row) => sum + row.height + ROW_GAP, -ROW_GAP)
  );

  const titleLineHeight = Math.round(titleSize * 1.05);
  const headerHeight = titleLines.length * titleLineHeight + 20 + 26 + 44;
  const footerHeight = 96;
  const height = PAD + headerHeight + 44 + Math.max(...columnHeights) + footerHeight + PAD - 24;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const spacing = (value: string) => { if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value; };

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';

  // Header
  let y = PAD;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(800, titleSize);
  spacing('-1.5px');
  titleLines.forEach(line => {
    y += titleLineHeight;
    ctx.fillText(line, PAD, y - titleLineHeight * 0.22);
  });
  y += 20;
  ctx.fillStyle = '#9CA3AF';
  ctx.font = font(700, 22);
  spacing('2.5px');
  ctx.fillText(subtitle.toUpperCase(), PAD, y + 22);
  spacing('0px');
  y += 26 + 44;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(PAD, y, width - PAD * 2, 2);
  y += 44;

  // Rows
  const top = y;
  rows.forEach((row, position) => {
    const column = Math.floor(position / perColumn);
    if (position % perColumn === 0) y = top;
    const x = PAD + column * (columnWidth + COLUMN_GAP);
    const { style } = row;

    ctx.fillStyle = style.background;
    roundedRect(ctx, x, y, columnWidth, row.height, compact ? 18 : 28);
    ctx.fill();

    const textBlockHeight = row.lines.length * row.lineHeight;
    const firstBaseline = y + (row.height - textBlockHeight) / 2 + row.lineHeight * 0.78;

    ctx.fillStyle = style.rankColor;
    ctx.font = font(700, style.rankSize, MONO);
    ctx.fillText(String(row.index + 1).padStart(2, '0'), x + rowPadX, firstBaseline);

    let textX = x + rowPadX + rankWidth;
    const image = images[row.index];
    if (row.thumb) {
      if (image) drawThumb(ctx, image, textX, y + (row.height - row.thumb) / 2, row.thumb, compact ? 8 : 16);
      textX += row.thumb + 20;
    }

    ctx.fillStyle = style.labelColor;
    ctx.font = font(style.labelWeight, style.labelSize);
    spacing('-0.5px');
    row.lines.forEach((line, lineIndex) => ctx.fillText(line, textX, firstBaseline + lineIndex * row.lineHeight));
    spacing('0px');

    y += row.height + ROW_GAP;
  });

  // Footer
  const footerY = height - PAD + 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(800, 24);
  spacing('1px');
  ctx.fillText('THE ORDER', PAD, footerY);
  const brandWidth = ctx.measureText('THE ORDER').width;
  spacing('0px');
  ctx.fillStyle = '#9CA3AF';
  ctx.font = font(600, 22);
  ctx.fillText(footer, PAD + brandWidth + 20, footerY);

  return canvas;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png');
  });
}

/** A safe file name from a ranking title, for example "best-beatles-albums.png". */
export function imageFileName(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'ranking'}.png`;
}
