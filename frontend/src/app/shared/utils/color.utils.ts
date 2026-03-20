// Color utilities for dynamic badge/pill coloring

export interface ColorPair {
  bg: string;
  text: string;
}

const DEFAULT_COLOR: ColorPair = { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b' };

const COLOR_PALETTE: ColorPair[] = [
  { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
  { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563eb' },
  { bg: 'rgba(29, 78, 216, 0.12)', text: '#1d4ed8' },
  { bg: 'rgba(96, 165, 250, 0.12)', text: '#3b82f6' },
  { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
  { bg: 'rgba(124, 58, 237, 0.12)', text: '#7c3aed' },
  { bg: 'rgba(167, 139, 250, 0.12)', text: '#7c3aed' },
  { bg: 'rgba(192, 132, 252, 0.12)', text: '#9333ea' },
  { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1' },
  { bg: 'rgba(79, 70, 229, 0.12)', text: '#4f46e5' },
  { bg: 'rgba(129, 140, 248, 0.12)', text: '#4f46e5' },
  { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
  { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
  { bg: 'rgba(5, 150, 105, 0.12)', text: '#059669' },
  { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6' },
  { bg: 'rgba(13, 148, 136, 0.12)', text: '#0d9488' },
  { bg: 'rgba(132, 204, 22, 0.12)', text: '#65a30d' },
  { bg: 'rgba(163, 230, 53, 0.12)', text: '#65a30d' },
  { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4' },
  { bg: 'rgba(8, 145, 178, 0.12)', text: '#0891b2' },
  { bg: 'rgba(34, 211, 238, 0.12)', text: '#06b6d4' },
  { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706' },
  { bg: 'rgba(217, 119, 6, 0.12)', text: '#b45309' },
  { bg: 'rgba(251, 191, 36, 0.12)', text: '#d97706' },
  { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
  { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
  { bg: 'rgba(234, 88, 12, 0.12)', text: '#c2410c' },
  { bg: 'rgba(251, 146, 60, 0.12)', text: '#ea580c' },
  { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
  { bg: 'rgba(220, 38, 38, 0.12)', text: '#b91c1c' },
  { bg: 'rgba(248, 113, 113, 0.12)', text: '#dc2626' },
  { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
  { bg: 'rgba(219, 39, 119, 0.12)', text: '#be185d' },
  { bg: 'rgba(244, 114, 182, 0.12)', text: '#db2777' },
  { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48' },
  { bg: 'rgba(225, 29, 72, 0.12)', text: '#be123c' },
  { bg: 'rgba(251, 113, 133, 0.12)', text: '#e11d48' },
  { bg: 'rgba(217, 70, 239, 0.12)', text: '#c026d3' },
  { bg: 'rgba(192, 38, 211, 0.12)', text: '#a21caf' },
  { bg: 'rgba(100, 116, 139, 0.12)', text: '#475569' },
  { bg: 'rgba(71, 85, 105, 0.12)', text: '#334155' },
  { bg: 'rgba(14, 165, 233, 0.12)', text: '#0284c7' },
  { bg: 'rgba(2, 132, 199, 0.12)', text: '#0369a1' },
  { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea' },
  { bg: 'rgba(74, 222, 128, 0.12)', text: '#16a34a' },
  { bg: 'rgba(45, 212, 191, 0.12)', text: '#0d9488' },
  { bg: 'rgba(253, 186, 116, 0.12)', text: '#ea580c' },
  { bg: 'rgba(252, 165, 165, 0.12)', text: '#dc2626' },
  { bg: 'rgba(196, 181, 253, 0.12)', text: '#7c3aed' },
];

// Caches for performance
const brandColorCache = new Map<string, ColorPair>();
const categoryColorCache = new Map<string, ColorPair>();

function getColorForString(value: string): ColorPair {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

export function getBrandColor(brand: string): ColorPair {
  if (!brand) return DEFAULT_COLOR;
  let color = brandColorCache.get(brand);
  if (!color) {
    color = getColorForString(brand);
    brandColorCache.set(brand, color);
  }
  return color;
}

export function getCategoryColor(category: string): ColorPair {
  if (!category) return DEFAULT_COLOR;
  let color = categoryColorCache.get(category);
  if (!color) {
    color = getColorForString(category + '_cat');
    categoryColorCache.set(category, color);
  }
  return color;
}

export function getPriorityColor(priority: number): ColorPair {
  const colors: { [key: number]: ColorPair } = {
    0: DEFAULT_COLOR,
    1: { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626' },
    2: { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
    3: { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
    4: { bg: 'rgba(34, 197, 94, 0.12)', text: '#16a34a' },
    5: { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' }
  };
  return colors[priority] || DEFAULT_COLOR;
}

export function getPackageTypeColor(packageType: string): ColorPair {
  const colors: { [key: string]: ColorPair } = {
    'Carton': { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed' },
    'Paquet': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
    'Fardeau': { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777' },
    'Bouteille': { bg: 'rgba(6, 182, 212, 0.12)', text: '#0891b2' },
    'Sachet': { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
    'Boîte': { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c' },
    'Palette': { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' }
  };
  return colors[packageType] || DEFAULT_COLOR;
}

export function getUnitColor(unit: string): ColorPair {
  const colors: { [key: string]: ColorPair } = {
    // Piece / Individual - Green tones
    'piece': { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
    'unit': { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e' },
    'portion': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
    'slice': { bg: 'rgba(20, 184, 166, 0.12)', text: '#14b8a6' },
    // Container - Blue/Purple tones
    'bottle': { bg: 'rgba(6, 182, 212, 0.12)', text: '#06b6d4' },
    'can': { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9' },
    'jar': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6' },
    'box': { bg: 'rgba(99, 102, 241, 0.12)', text: '#6366f1' },
    'sachet': { bg: 'rgba(234, 179, 8, 0.12)', text: '#ca8a04' },
    'tray': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8b5cf6' },
    'pot': { bg: 'rgba(217, 70, 239, 0.12)', text: '#d946ef' },
    'tube': { bg: 'rgba(236, 72, 153, 0.12)', text: '#ec4899' },
    // Weight - Red/Orange tones
    'kg': { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' },
    'g': { bg: 'rgba(249, 115, 22, 0.12)', text: '#f97316' },
    // Volume - Cyan tones
    'L': { bg: 'rgba(8, 145, 178, 0.12)', text: '#0891b2' },
    'ml': { bg: 'rgba(34, 211, 238, 0.12)', text: '#22d3ee' },
    'cl': { bg: 'rgba(103, 232, 249, 0.12)', text: '#06b6d4' },
    // Bulk / Logistic - Various
    'carton': { bg: 'rgba(124, 58, 237, 0.12)', text: '#7c3aed' },
    'crate': { bg: 'rgba(79, 70, 229, 0.12)', text: '#4f46e5' },
    'pack': { bg: 'rgba(37, 99, 235, 0.12)', text: '#2563eb' },
    'dozen': { bg: 'rgba(14, 165, 233, 0.12)', text: '#0ea5e9' },
    'bunch': { bg: 'rgba(16, 185, 129, 0.12)', text: '#10b981' },
    'pound': { bg: 'rgba(168, 85, 247, 0.12)', text: '#a855f7' }
  };
  return colors[unit] || DEFAULT_COLOR;
}

export function getUnitLabel(unit: string): string {
  const labels: { [key: string]: string } = {
    // Piece / Individual
    'piece': 'Pièce',
    'unit': 'Unité',
    'portion': 'Portion',
    'slice': 'Tranche',
    // Container
    'bottle': 'Bouteille',
    'can': 'Canette',
    'jar': 'Bocal',
    'box': 'Boîte',
    'sachet': 'Sachet',
    'tray': 'Barquette',
    'pot': 'Pot',
    'tube': 'Tube',
    // Weight
    'kg': 'Kg',
    'g': 'Gramme',
    // Volume
    'L': 'Litre',
    'ml': 'Millilitre',
    'cl': 'Centilitre',
    // Bulk / Logistic
    'carton': 'Carton',
    'crate': 'Caisse',
    'pack': 'Pack',
    'dozen': 'Douzaine',
    'bunch': 'Botte',
    'pound': 'Livre'
  };
  return labels[unit] || unit;
}

export function getPriorityLabel(priority: number): string {
  return priority === 0 ? '-' : priority.toString();
}
