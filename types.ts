export enum LightType {
  SPOTLIGHT = 'SPOTLIGHT',
  LINEAR = 'LINEAR',
  NATURAL = 'NATURAL',
  POINT = 'POINT',
  RIM = 'RIM',
  SOFTBOX = 'SOFTBOX'
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  type: LightType;
  color: string;
  size: number;
  isVisible: boolean;
}

export interface LightingConfig {
  brushSize: number;
  selectedLight: LightType;
  opacity: number;
}
