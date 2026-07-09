/**
 * Map and geolocation constants
 * Contains default location settings and Leaflet configurations
 */

// Default location (Ouadhia, Tizi Ouzou - Store/Warehouse location)
export const MAP_DEFAULTS = {
  // Default center coordinates (AgroClik Depot)
  LATITUDE: 36.549608,
  LONGITUDE: 4.099945,
  ZOOM: 15,
  OVERVIEW_ZOOM: 10,

  // Geolocation API settings
  GEOLOCATION_TIMEOUT: 15000,
  GEOLOCATION_MAX_AGE: 0,
  MAX_ACCURACY_RADIUS: 100  // Maximum circle radius in meters
} as const;

// Leaflet marker icon configuration
export const LEAFLET_ICON = {
  SIZE: [25, 41] as [number, number],
  ANCHOR: [12, 41] as [number, number],
  POPUP_ANCHOR: [1, -34] as [number, number],
  TOOLTIP_ANCHOR: [16, -28] as [number, number],
  SHADOW_SIZE: [41, 41] as [number, number]
} as const;

// Leaflet tile layer configuration
// Note: SUBDOMAINS is not marked as const to allow assignment to Leaflet's mutable type
export const LEAFLET_TILES = {
  GOOGLE: {
    URL: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    MAX_ZOOM: 24,
    SUBDOMAINS: ['mt0', 'mt1', 'mt2', 'mt3'] as string[],
    ATTRIBUTION: '&copy; Google Maps'
  },
  CARTODB_LIGHT: {
    URL: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    MAX_ZOOM: 20,
    SUBDOMAINS: ['a', 'b', 'c', 'd'] as string[],
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  CARTODB_DARK: {
    URL: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    MAX_ZOOM: 20,
    SUBDOMAINS: ['a', 'b', 'c', 'd'] as string[],
    ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  OSM: {
    URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© OpenStreetMap'
  }
};

// Algeria's 58 wilayas as select options
export const ALGERIA_WILAYAS: { label: string; value: string }[] = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
  'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
  'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
  'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
  'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
  'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent',
  'Ghardaïa', 'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès',
  'In Salah', 'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
].map(w => ({ label: w, value: w }));

// Normalize a wilaya string (from Nominatim/Google Maps) to match ALGERIA_WILAYAS values
export function matchAlgeriaWilaya(value: string): string {
  if (!value) return '';
  const normalized = value.toLowerCase()
    .replace(/-/g, ' ')
    .replace(/^wilaya\s+(de\s+)?/i, '')
    .replace(/\s*(province|wilaya)\s*$/i, '')
    .trim();
  const match = ALGERIA_WILAYAS.find(opt =>
    opt.value.toLowerCase().replace(/-/g, ' ').trim() === normalized
  );
  return match ? match.value : value;
}

// Leaflet asset paths
export const LEAFLET_ASSETS = {
  MARKER_ICON: 'assets/leaflet/marker-icon.png',
  MARKER_ICON_RETINA: 'assets/leaflet/marker-icon-2x.png',
  MARKER_SHADOW: 'assets/leaflet/marker-shadow.png'
} as const;
