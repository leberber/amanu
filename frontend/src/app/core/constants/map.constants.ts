/**
 * Map and geolocation constants
 * Contains default location settings and Leaflet configurations
 */

// Default location (Ouadhia, Tizi Ouzou - Store/Warehouse location)
export const MAP_DEFAULTS = {
  // Default center coordinates (Ouadhia Centre)
  LATITUDE: 36.5550,
  LONGITUDE: 4.0850,
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
  OSM: {
    URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ATTRIBUTION: '© OpenStreetMap'
  }
};

// Leaflet asset paths
export const LEAFLET_ASSETS = {
  MARKER_ICON: 'assets/leaflet/marker-icon.png',
  MARKER_ICON_RETINA: 'assets/leaflet/marker-icon-2x.png',
  MARKER_SHADOW: 'assets/leaflet/marker-shadow.png'
} as const;
