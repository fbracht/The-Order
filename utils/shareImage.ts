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
  rankWidth: number;
  padX: number;
  padY: number;
  thumb: number;
  radius: number;
  background: string;
  maxLines: number;
}

// A long list (over MAX_SINGLE_COLUMN items) shows its first ten places as
// full-width rows, exactly like a short list, and the rest as small rows in
// bands of ten: 11-20, 21-30... Each band is read down its left half, then
// its right, so the eye never travels far and the picture ends on the last place.
const FEATURED = 10;
const BAND_SIZE = 10;
// A last band with fewer places than this joins the band before it, so the
// picture never ends on one or two stray rows.
const MIN_LAST_BAND = 5;

/**
 * inGrid: the small one-line rows used in the columns of a long list.
 * scale: enlarges the full-width rows on the wider canvas of a long list.
 */
function rowStyle(index: number, inGrid: boolean, longList: boolean): RowStyle {
  const scale = longList ? 1.2 : 1;
  const rankColor = RANK_COLORS[index] ?? '#9CA3AF';
  const quiet = 'rgba(255,255,255,0.06)';
  if (inGrid) {
    return { labelSize: 26, labelWeight: 600, labelColor: '#D1D5DB', rankSize: 20, rankColor, rankWidth: 52, padX: 20, padY: 16, thumb: 40, radius: 18, background: quiet, maxLines: 1 };
  }
  const tier =
    index === 0 ? { labelSize: 60, labelWeight: 800, labelColor: '#FFFFFF', rankSize: 34, padY: 42, thumb: 168, background: 'rgba(255,255,255,0.14)' }
    : index < 3 ? { labelSize: 46, labelWeight: 700, labelColor: '#FFFFFF', rankSize: 28, padY: 32, thumb: 116, background: 'rgba(255,255,255,0.09)' }
    : { labelSize: 29, labelWeight: 600, labelColor: '#D1D5DB', rankSize: 22, padY: 20, thumb: 64, background: quiet };
  const px = (value: number) => Math.round(value * scale);
  return {
    ...tier,
    labelSize: px(tier.labelSize),
    rankSize: px(tier.rankSize),
    padY: px(tier.padY),
    thumb: px(tier.thumb),
    rankColor,
    rankWidth: px(76),
    padX: px(32),
    radius: px(28),
    maxLines: 3
  };
}

export async function renderRankingImage({ title, subtitle, items, footer }: ShareImageInput): Promise<HTMLCanvasElement> {
  // Canvas text falls back silently to a system font unless the web font is ready
  if (document.fonts?.load) {
    await Promise.all([600, 700, 800].map(weight => document.fonts.load(font(weight, 40))));
  }
  const images = await Promise.all(items.map(item => (item.imageUrl ? loadImage(item.imageUrl) : Promise.resolve(null))));
  const hasImages = images.some(Boolean);

  const compact = items.length > MAX_SINGLE_COLUMN;
  const fullWidthCount = compact ? FEATURED : items.length;
  const gridCount = items.length - fullWidthCount;
  const columns = compact ? 2 : 1;
  const width = compact ? PAD * 2 + columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP : SINGLE_WIDTH;
  const scale = compact ? 1.2 : 1;

  // Text can only be measured with a canvas, so lay everything out first on a
  // scratch one, then size the real canvas to fit.
  const measure = document.createElement('canvas').getContext('2d')!;

  const titleSize = Math.round(112 * scale);
  measure.font = font(800, titleSize);
  const titleLines = wrapText(measure, title, width - PAD * 2, 3);

  const rows = items.map((item, index) => {
    const inGrid = index >= fullWidthCount;
    const style = rowStyle(index, inGrid, compact);
    const rowWidth = inGrid ? COLUMN_WIDTH : width - PAD * 2;
    const thumb = hasImages ? style.thumb : 0;
    const textWidth = rowWidth - style.padX * 2 - style.rankWidth - (thumb ? thumb + 20 : 0);
    measure.font = font(style.labelWeight, style.labelSize);
    const lines = wrapText(measure, item.label, textWidth, style.maxLines);
    const lineHeight = Math.round(style.labelSize * 1.2);
    const height = Math.max(lines.length * lineHeight, thumb) + style.padY * 2;
    return { item, index, style, thumb, lines, lineHeight, height, rowWidth };
  });
  const fullRows = rows.slice(0, fullWidthCount);
  const gridRows = rows.slice(fullWidthCount);

  const fullHeight = fullRows.reduce((sum, row) => sum + row.height + ROW_GAP, -ROW_GAP);
  // Split the small rows into bands that end on round numbers
  const GRID_GAP = 36;
  const BAND_LABEL = 44;
  const groups: (typeof rows)[] = [];
  for (let start = 0; start < gridRows.length; start += BAND_SIZE) groups.push(gridRows.slice(start, start + BAND_SIZE));
  if (groups.length > 1 && groups[groups.length - 1].length < MIN_LAST_BAND) {
    const last = groups.pop()!;
    groups[groups.length - 1].push(...last);
  }
  const placed: { row: (typeof rows)[number]; x: number; y: number }[] = [];
  const labels: { text: string; y: number }[] = [];
  let gridHeight = 0;
  groups.forEach(group => {
    gridHeight += labels.length ? 28 : GRID_GAP;
    labels.push({ text: `${group[0].index + 1}–${group[group.length - 1].index + 1}`, y: gridHeight });
    gridHeight += BAND_LABEL;
    const perColumn = Math.ceil(group.length / columns);
    let tallest = 0;
    for (let column = 0; column < columns; column++) {
      let offset = 0;
      group.slice(column * perColumn, (column + 1) * perColumn).forEach(row => {
        placed.push({ row, x: PAD + column * (COLUMN_WIDTH + COLUMN_GAP), y: gridHeight + offset });
        offset += row.height + ROW_GAP;
      });
      tallest = Math.max(tallest, offset - ROW_GAP);
    }
    gridHeight += tallest;
  });

  const titleLineHeight = Math.round(titleSize * 1.02);
  const subtitleSize = Math.round(24 * scale);
  const headerHeight = titleLines.length * titleLineHeight + 24 + subtitleSize + 48;
  const footerHeight = 96;
  const height = PAD + headerHeight + 44 + fullHeight + gridHeight + footerHeight + PAD - 24;

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
  spacing(`${-titleSize * 0.025}px`);
  titleLines.forEach(line => {
    y += titleLineHeight;
    ctx.fillText(line, PAD, y - titleLineHeight * 0.2);
  });
  y += 24;
  ctx.fillStyle = '#9CA3AF';
  ctx.font = font(700, subtitleSize);
  spacing('2.5px');
  ctx.fillText(subtitle.toUpperCase(), PAD, y + subtitleSize);
  spacing('0px');
  y += subtitleSize + 48;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(PAD, y, width - PAD * 2, 2);
  y += 44;

  const drawRow = (row: (typeof rows)[number], x: number, top: number) => {
    const { style } = row;
    ctx.fillStyle = style.background;
    roundedRect(ctx, x, top, row.rowWidth, row.height, style.radius);
    ctx.fill();

    const textBlockHeight = row.lines.length * row.lineHeight;
    const firstBaseline = top + (row.height - textBlockHeight) / 2 + row.lineHeight * 0.78;

    ctx.fillStyle = style.rankColor;
    ctx.font = font(700, style.rankSize, MONO);
    ctx.fillText(String(row.index + 1).padStart(2, '0'), x + style.padX, firstBaseline);

    let textX = x + style.padX + style.rankWidth;
    const image = images[row.index];
    if (row.thumb) {
      if (image) drawThumb(ctx, image, textX, top + (row.height - row.thumb) / 2, row.thumb, Math.round(style.radius * 0.55));
      textX += row.thumb + 20;
    }

    ctx.fillStyle = style.labelColor;
    ctx.font = font(style.labelWeight, style.labelSize);
    spacing('-0.5px');
    row.lines.forEach((line, lineIndex) => ctx.fillText(line, textX, firstBaseline + lineIndex * row.lineHeight));
    spacing('0px');
  };

  // Full-width rows
  fullRows.forEach(row => {
    drawRow(row, PAD, y);
    y += row.height + ROW_GAP;
  });

  // Small rows, with a label above each band
  const gridTop = y - ROW_GAP;
  ctx.fillStyle = '#6B7280';
  ctx.font = font(700, 20, MONO);
  labels.forEach(label => ctx.fillText(label.text, PAD + 4, gridTop + label.y + 22));
  placed.forEach(({ row, x, y: offset }) => drawRow(row, x, gridTop + offset));

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
