export interface AvatarState {
  name: string;
  faceShape: string;
  skinTone: string;
  eyeShape: string;
  eyeColor: string;
  eyeSize: number;
  eyeSpacing: number;
  eyebrowShape: string;
  eyebrowThickness: number;
  eyebrowColor: string;
  noseShape: string;
  noseSize: number;
  mouthShape: string;
  mouthColor: string;
  mouthSize: number;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  facialHairColor: string;
  accessory: string;
  accessoryColor: string;
  clothingStyle: string;
  clothingColor: string;
  bgColor: string;
  bgGradient: string;
}

export type AvatarKey = keyof AvatarState;

export interface HistoryEntry {
  state: AvatarState;
  timestamp: number;
}

export interface AvatarPreset {
  name: string;
  state: AvatarState;
  thumbnail?: string;
}

export const SKIN_TONES = [
  '#FDDBB4', '#F5C7A1', '#E8AD82', '#D49B6A',
  '#C08852', '#A67640', '#8C6430', '#6B4C22',
  '#4A3518', '#2D1F0E', '#FCE4D6', '#F0D0B4',
];

export const HAIR_COLORS = [
  '#1a1a1a', '#3d2b1f', '#6b4423', '#8b6914',
  '#b8860b', '#d4a017', '#f5d033', '#e8a0bf',
  '#c0392b', '#8e44ad', '#2980b9', '#27ae60',
  '#f39c12', '#ecf0f1', '#95a5a6', '#2c3e50',
];

export const EYE_COLORS = [
  '#4a3520', '#6b4c22', '#2e7d32', '#1565c0',
  '#4a148c', '#37474f', '#00838f', '#5d4037',
];

export const MOUTH_COLORS = [
  '#c0392b', '#e74c3c', '#d35400', '#e67e22',
  '#8b4513', '#cd5c5c', '#db7093', '#c2185b',
];

export const CLOTHING_COLORS = [
  '#1565c0', '#c62828', '#2e7d32', '#f57f17',
  '#6a1b9a', '#00838f', '#d84315', '#37474f',
  '#ffffff', '#212121', '#455a64', '#0277bd',
];

export const FACE_SHAPES = ['oval', 'round', 'square', 'heart', 'long'];
export const EYE_SHAPES = ['round', 'almond', 'wide', 'narrow', 'cat', 'droopy'];
export const EYEBROW_SHAPES = ['natural', 'arched', 'straight', 'angled', 'thin', 'thick', 'unibrow'];
export const NOSE_SHAPES = ['small', 'medium', 'large', 'pointed', 'round', 'flat'];
export const MOUTH_SHAPES = ['smile', 'neutral', 'grin', 'smirk', 'open', 'pout', 'wide'];
export const HAIR_STYLES = ['none', 'buzz', 'short', 'medium', 'long', 'ponytail', 'bun', 'mohawk', 'curly', 'afro', 'spiky', 'wavy', 'bob', 'pixie', 'side-swept'];
export const FACIAL_HAIR_STYLES = ['none', 'stubble', 'goatee', 'mustache', 'full', 'circle', 'handlebar', 'wizard'];
export const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'round-glasses', 'earrings', 'headband', 'bandana', 'bow'];
export const CLOTHING_STYLES = ['tshirt', 'polo', 'hoodie', 'suit', 'vneck', 'turtleneck', 'tanktop'];

export function createDefaultAvatar(): AvatarState {
  return {
    name: 'My Avatar',
    faceShape: 'oval',
    skinTone: '#FDDBB4',
    eyeShape: 'round',
    eyeColor: '#4a3520',
    eyeSize: 1,
    eyeSpacing: 1,
    eyebrowShape: 'natural',
    eyebrowThickness: 1,
    eyebrowColor: '#3d2b1f',
    noseShape: 'small',
    noseSize: 1,
    mouthShape: 'smile',
    mouthColor: '#c0392b',
    mouthSize: 1,
    hairStyle: 'short',
    hairColor: '#3d2b1f',
    facialHair: 'none',
    facialHairColor: '#3d2b1f',
    accessory: 'none',
    accessoryColor: '#37474f',
    clothingStyle: 'tshirt',
    clothingColor: '#1565c0',
    bgColor: '#e8f4fd',
    bgGradient: 'linear-gradient(180deg, #e8f4fd 0%, #b3e0ff 100%)',
  };
}

export const PRESETS: AvatarPreset[] = [
  { name: 'Default', state: createDefaultAvatar() },
  {
    name: 'Business Pro',
    state: {
      ...createDefaultAvatar(),
      name: 'Business Pro',
      faceShape: 'square',
      skinTone: '#F5C7A1',
      eyeShape: 'almond',
      eyebrowShape: 'straight',
      noseShape: 'medium',
      mouthShape: 'neutral',
      hairStyle: 'short',
      hairColor: '#1a1a1a',
      clothingStyle: 'suit',
      clothingColor: '#212121',
      accessory: 'glasses',
      accessoryColor: '#37474f',
    },
  },
  {
    name: 'Creative Spirit',
    state: {
      ...createDefaultAvatar(),
      name: 'Creative Spirit',
      faceShape: 'heart',
      skinTone: '#E8AD82',
      eyeShape: 'cat',
      eyebrowShape: 'arched',
      noseShape: 'pointed',
      mouthShape: 'grin',
      hairStyle: 'curly',
      hairColor: '#8b6914',
      clothingStyle: 'vneck',
      clothingColor: '#6a1b9a',
    },
  },
  {
    name: 'Athlete',
    state: {
      ...createDefaultAvatar(),
      name: 'Athlete',
      faceShape: 'round',
      skinTone: '#C08852',
      eyeShape: 'wide',
      eyebrowShape: 'thick',
      noseShape: 'medium',
      mouthShape: 'smile',
      hairStyle: 'buzz',
      hairColor: '#1a1a1a',
      clothingStyle: 'tanktop',
      clothingColor: '#c62828',
    },
  },
  {
    name: 'Cool Vibes',
    state: {
      ...createDefaultAvatar(),
      name: 'Cool Vibes',
      faceShape: 'oval',
      skinTone: '#FDDBB4',
      eyeShape: 'narrow',
      eyebrowShape: 'angled',
      noseShape: 'small',
      mouthShape: 'smirk',
      hairStyle: 'side-swept',
      hairColor: '#6b4423',
      facialHair: 'stubble',
      clothingStyle: 'hoodie',
      clothingColor: '#37474f',
      accessory: 'sunglasses',
      accessoryColor: '#1a1a1a',
    },
  },
  {
    name: 'Wise Elder',
    state: {
      ...createDefaultAvatar(),
      name: 'Wise Elder',
      faceShape: 'long',
      skinTone: '#D49B6A',
      eyeShape: 'droopy',
      eyebrowShape: 'thick',
      noseShape: 'large',
      mouthShape: 'smile',
      hairStyle: 'none',
      facialHair: 'wizard',
      facialHairColor: '#95a5a6',
      eyebrowColor: '#95a5a6',
      clothingStyle: 'turtleneck',
      clothingColor: '#2e7d32',
      accessory: 'round-glasses',
      accessoryColor: '#8b6914',
    },
  },
];
