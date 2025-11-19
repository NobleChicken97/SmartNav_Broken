export const MAP_CONFIG = {
  // Thapar Institute coordinates (Patiala, Punjab)
  center: {
    lat: 30.3548,
    lng: 76.3635
  },
  zoom: 16,
  maxZoom: 19,
  minZoom: 15,  // Prevent zooming out too far - keeps focus on campus
  
  // Tile layer configuration
  tileLayer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  },
  
  // Alternative tile layers you can use
  alternativeTiles: {
    // Satellite view
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri, Maxar, Earthstar Geographics'
    },
    // Dark theme
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '© OpenStreetMap, © CARTO'
    },
    // Terrain
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '© OpenTopoMap, © OpenStreetMap contributors'
    }
  }
};

// Campus boundary (approximate)
export const CAMPUS_BOUNDS = {
  north: 30.3600,
  south: 30.3500,
  east: 76.3700,
  west: 76.3570
};

// Custom marker icons for different location types
export const MARKER_ICONS = {
  // New location types
  hostel: '🏠',
  class: '🎓',
  faculty: '👨‍🏫',
  entertainment: '🎭',
  shop: '🛒',
  // Legacy support for old types
  building: '🏫',
  room: '🚪',
  poi: '📍',
  academic: '🏫',
  cafeteria: '🍽️',
  library: '📚',
  sports: '⚽',
  medical: '🏥',
  admin: '🏢',
  parking: '🅿️',
  atm: '🏧',
  event: '🎉'
};

// Marker colors for different location types
export const MARKER_COLORS = {
  hostel: '#10b981',      // Green
  class: '#3b82f6',       // Blue
  faculty: '#8b5cf6',     // Purple
  entertainment: '#ec4899', // Pink
  shop: '#f97316',        // Orange
  // Legacy colors
  building: '#2563eb',
  room: '#2563eb',
  poi: '#2563eb'
};
