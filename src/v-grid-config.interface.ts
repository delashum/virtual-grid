export interface VirtualGridConfig {
  gravity?: 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'en' | 'es' | 'sw' | 'se' | 'wn' | 'ws';
  x_lanes?: { min: number; max: number };
  y_lanes?: { min: number; max: number };
  namespace?: string[];
}
