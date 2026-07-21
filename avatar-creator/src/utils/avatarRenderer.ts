import { AvatarState } from '../types/avatar';

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function getFacePath(shape: string): string {
  const cx = 200, cy = 200;
  switch (shape) {
    case 'round':
      return `M${cx},${cy - 120} A120,120 0 1,1 ${cx - 0.01},${cy - 120} Z`;
    case 'square':
      return `M${cx - 100},${cy - 105} Q${cx - 100},${cy - 130} ${cx - 60},${cy - 130} L${cx + 60},${cy - 130} Q${cx + 100},${cy - 130} ${cx + 100},${cy - 105} L${cx + 100},${cy + 85} Q${cx + 100},${cy + 120} ${cx + 60},${cy + 120} L${cx - 60},${cy + 120} Q${cx - 100},${cy + 120} ${cx - 100},${cy + 85} Z`;
    case 'heart':
      return `M${cx},${cy - 115} C${cx - 40},${cy - 150} ${cx - 120},${cy - 110} ${cx - 110},${cy - 40} C${cx - 105},${cy + 10} ${cx - 40},${cy + 110} ${cx},${cy + 120} C${cx + 40},${cy + 110} ${cx + 105},${cy + 10} ${cx + 110},${cy - 40} C${cx + 120},${cy - 110} ${cx + 40},${cy - 150} ${cx},${cy - 115} Z`;
    case 'long':
      return `M${cx},${cy - 135} A95,135 0 1,1 ${cx - 0.01},${cy - 135} Z`;
    default: // oval
      return `M${cx},${cy - 125} A110,125 0 1,1 ${cx - 0.01},${cy - 125} Z`;
  }
}

function renderEyes(a: AvatarState): string {
  const cx = 200, cy = 195;
  const spacing = 38 * a.eyeSpacing;
  const size = 18 * a.eyeSize;
  let svg = '';

  for (const side of [-1, 1]) {
    const ex = cx + side * spacing;
    const ey = cy;

    switch (a.eyeShape) {
      case 'almond':
        svg += `<ellipse cx="${ex}" cy="${ey}" rx="${size * 1.3}" ry="${size * 0.8}" fill="white" stroke="#333" stroke-width="1.5"/>`;
        svg += `<circle cx="${ex + side * 2}" cy="${ey}" r="${size * 0.55}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex + side * 1}" cy="${ey - 2}" r="${size * 0.2}" fill="white"/>`;
        break;
      case 'wide':
        svg += `<circle cx="${ex}" cy="${ey}" r="${size * 1.2}" fill="white" stroke="#333" stroke-width="1.5"/>`;
        svg += `<circle cx="${ex}" cy="${ey + 1}" r="${size * 0.65}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex - 2}" cy="${ey - 3}" r="${size * 0.25}" fill="white"/>`;
        break;
      case 'narrow':
        svg += `<ellipse cx="${ex}" cy="${ey}" rx="${size * 1.1}" ry="${size * 0.5}" fill="white" stroke="#333" stroke-width="1.5"/>`;
        svg += `<circle cx="${ex}" cy="${ey}" r="${size * 0.4}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex - 1}" cy="${ey - 1}" r="${size * 0.15}" fill="white"/>`;
        break;
      case 'cat':
        svg += `<path d="M${ex - size * 1.3},${ey} Q${ex},${ey - size * 1.1} ${ex + size * 1.3},${ey} Q${ex},${ey + size * 0.8} ${ex - size * 1.3},${ey}Z" fill="white" stroke="#333" stroke-width="1.5"/>`;
        svg += `<ellipse cx="${ex}" cy="${ey + 1}" rx="${size * 0.45}" ry="${size * 0.55}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex - 1}" cy="${ey - 2}" r="${size * 0.18}" fill="white"/>`;
        break;
      case 'droopy':
        svg += `<ellipse cx="${ex}" cy="${ey + 3}" rx="${size * 1.1}" ry="${size * 0.85}" fill="white" stroke="#333" stroke-width="1.5" transform="rotate(${side * 8}, ${ex}, ${ey + 3})"/>`;
        svg += `<circle cx="${ex}" cy="${ey + 4}" r="${size * 0.5}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex - 1}" cy="${ey + 2}" r="${size * 0.18}" fill="white"/>`;
        break;
      default: // round
        svg += `<circle cx="${ex}" cy="${ey}" r="${size}" fill="white" stroke="#333" stroke-width="1.5"/>`;
        svg += `<circle cx="${ex + side * 1}" cy="${ey + 1}" r="${size * 0.55}" fill="${a.eyeColor}"/>`;
        svg += `<circle cx="${ex - 1}" cy="${ey - 2}" r="${size * 0.2}" fill="white"/>`;
    }
  }

  return svg;
}

function renderEyebrows(a: AvatarState): string {
  const cx = 200, cy = 170;
  const spacing = 38 * a.eyeSpacing;
  const thick = 3 * a.eyebrowThickness;
  let svg = '';

  for (const side of [-1, 1]) {
    const bx = cx + side * spacing;
    const by = cy;
    const flip = side === -1 ? '' : ' transform="scale(-1,1)"';

    switch (a.eyebrowShape) {
      case 'arched':
        svg += `<path d="M${bx - side * 18},${by + 2} Q${bx},${by - 14} ${bx + side * 18},${by - 2}" fill="none" stroke="${a.eyebrowColor}" stroke-width="${thick}" stroke-linecap="round"/>`;
        break;
      case 'straight':
        svg += `<line x1="${bx - side * 17}" y1="${by}" x2="${bx + side * 17}" y2="${by - 1}" stroke="${a.eyebrowColor}" stroke-width="${thick}" stroke-linecap="round"/>`;
        break;
      case 'angled':
        svg += `<path d="M${bx - side * 17},${by + 5} L${bx + side * 2},${by - 10} L${bx + side * 17},${by}" fill="none" stroke="${a.eyebrowColor}" stroke-width="${thick}" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
      case 'thin':
        svg += `<path d="M${bx - side * 16},${by + 2} Q${bx},${by - 12} ${bx + side * 16},${by}" fill="none" stroke="${a.eyebrowColor}" stroke-width="${thick * 0.5}" stroke-linecap="round"/>`;
        break;
      case 'thick':
        svg += `<path d="M${bx - side * 18},${by + 4} Q${bx},${by - 16} ${bx + side * 18},${by + 1}" fill="${a.eyebrowColor}" stroke="none"/>`;
        break;
      case 'unibrow':
        if (side === -1) {
          svg += `<path d="M${cx - spacing - 18},${by + 2} Q${cx},${by - 16} ${cx + spacing + 18},${by + 2}" fill="none" stroke="${a.eyebrowColor}" stroke-width="${thick}" stroke-linecap="round"/>`;
        }
        break;
      default: // natural
        svg += `<path d="M${bx - side * 17},${by + 3} Q${bx - side * 4},${by - 10} ${bx + side * 17},${by - 1}" fill="none" stroke="${a.eyebrowColor}" stroke-width="${thick}" stroke-linecap="round"/>`;
    }
  }

  return svg;
}

function renderNose(a: AvatarState): string {
  const cx = 200, cy = 230;
  const s = a.noseSize;

  switch (a.noseShape) {
    case 'medium':
      return `<path d="M${cx},${cy - 12 * s} L${cx - 8 * s},${cy + 10 * s} Q${cx},${cy + 14 * s} ${cx + 8 * s},${cy + 10 * s} Z" fill="${darken(a.skinTone, 25)}" stroke="none"/>`;
    case 'large':
      return `<path d="M${cx - 3},${cy - 16 * s} L${cx - 12 * s},${cy + 14 * s} Q${cx},${cy + 18 * s} ${cx + 12 * s},${cy + 14 * s} L${cx + 3},${cy - 16 * s}" fill="${darken(a.skinTone, 30)}" stroke="none"/>`;
    case 'pointed':
      return `<path d="M${cx},${cy - 14 * s} L${cx - 7 * s},${cy + 8 * s} L${cx},${cy + 12 * s} L${cx + 7 * s},${cy + 8 * s} Z" fill="${darken(a.skinTone, 20)}" stroke="none"/>`;
    case 'round':
      return `<ellipse cx="${cx}" cy="${cy + 4 * s}" rx="${9 * s}" ry="${8 * s}" fill="${darken(a.skinTone, 25)}" stroke="none"/>`;
    case 'flat':
      return `<line x1="${cx - 6 * s}" y1="${cy + 6 * s}" x2="${cx + 6 * s}" y2="${cy + 6 * s}" stroke="${darken(a.skinTone, 30)}" stroke-width="2.5" stroke-linecap="round"/>`;
    default: // small
      return `<circle cx="${cx}" cy="${cy + 4 * s}" r="${4 * s}" fill="${darken(a.skinTone, 20)}" stroke="none"/>`;
  }
}

function renderMouth(a: AvatarState): string {
  const cx = 200, cy = 270;
  const s = a.mouthSize;

  switch (a.mouthShape) {
    case 'grin':
      return `<path d="M${cx - 22 * s},${cy} Q${cx},${cy + 24 * s} ${cx + 22 * s},${cy}" fill="white" stroke="${a.mouthColor}" stroke-width="2"/>` +
        `<path d="M${cx - 20 * s},${cy + 2} Q${cx},${cy + 18 * s} ${cx + 20 * s},${cy + 2}" fill="${a.mouthColor}"/>`;
    case 'smirk':
      return `<path d="M${cx - 16 * s},${cy + 4} Q${cx + 8 * s},${cy - 6} ${cx + 20 * s},${cy - 4}" fill="none" stroke="${a.mouthColor}" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'open':
      return `<ellipse cx="${cx}" cy="${cy + 4}" rx="${12 * s}" ry="${10 * s}" fill="#2c1810" stroke="${a.mouthColor}" stroke-width="2"/>` +
        `<ellipse cx="${cx}" cy="${cy - 2}" rx="${8 * s}" ry="${3 * s}" fill="white"/>`;
    case 'pout':
      return `<path d="M${cx - 16 * s},${cy + 6} Q${cx},${cy - 8} ${cx + 16 * s},${cy + 6}" fill="${a.mouthColor}" stroke="none"/>`;
    case 'wide':
      return `<path d="M${cx - 24 * s},${cy} Q${cx},${cy + 18 * s} ${cx + 24 * s},${cy} Q${cx},${cy - 4} ${cx - 24 * s},${cy}" fill="${a.mouthColor}" stroke="none"/>`;
    case 'neutral':
      return `<line x1="${cx - 14 * s}" y1="${cy}" x2="${cx + 14 * s}" y2="${cy}" stroke="${a.mouthColor}" stroke-width="2.5" stroke-linecap="round"/>`;
    default: // smile
      return `<path d="M${cx - 18 * s},${cy - 2} Q${cx},${cy + 16 * s} ${cx + 18 * s},${cy - 2}" fill="none" stroke="${a.mouthColor}" stroke-width="2.5" stroke-linecap="round"/>`;
  }
}

function renderHair(a: AvatarState): string {
  const cx = 200, cy = 200;
  const c = a.hairColor;
  if (a.hairStyle === 'none') return '';

  const hairShadow = darken(c, 20);

  switch (a.hairStyle) {
    case 'buzz':
      return `<ellipse cx="${cx}" cy="${cy - 90}" rx="118" ry="60" fill="${c}" opacity="0.7"/>`;
    case 'short':
      return `<path d="M${cx - 115},${cy - 70} Q${cx - 120},${cy - 160} ${cx - 40},${cy - 175} Q${cx},${cy - 185} ${cx + 40},${cy - 175} Q${cx + 120},${cy - 160} ${cx + 115},${cy - 70} L${cx + 100},${cy - 100} Q${cx + 80},${cy - 150} ${cx},${cy - 155} Q${cx - 80},${cy - 150} ${cx - 100},${cy - 100} Z" fill="${c}"/>` +
      `<path d="M${cx - 105},${cy - 100} Q${cx - 90},${cy - 145} ${cx},${cy - 148} Q${cx + 90},${cy - 145} ${cx + 105},${cy - 100}" fill="${hairShadow}" opacity="0.3"/>`;
    case 'medium':
      return `<path d="M${cx - 120},${cy - 50} Q${cx - 130},${cy - 165} ${cx - 50},${cy - 180} Q${cx},${cy - 190} ${cx + 50},${cy - 180} Q${cx + 130},${cy - 165} ${cx + 120},${cy - 50} L${cx + 115},${cy - 80} Q${cx + 90},${cy - 155} ${cx},${cy - 160} Q${cx - 90},${cy - 155} ${cx - 115},${cy - 80} Z" fill="${c}"/>` +
      `<path d="M${cx - 120},${cy - 50} Q${cx - 130},${cy} ${cx - 125},${cy + 30}" fill="none" stroke="${c}" stroke-width="18" stroke-linecap="round"/>` +
      `<path d="M${cx + 120},${cy - 50} Q${cx + 130},${cy} ${cx + 125},${cy + 30}" fill="none" stroke="${c}" stroke-width="18" stroke-linecap="round"/>`;
    case 'long':
      return `<path d="M${cx - 120},${cy - 50} Q${cx - 130},${cy - 165} ${cx - 50},${cy - 180} Q${cx},${cy - 190} ${cx + 50},${cy - 180} Q${cx + 130},${cy - 165} ${cx + 120},${cy - 50} L${cx + 115},${cy - 80} Q${cx + 90},${cy - 155} ${cx},${cy - 160} Q${cx - 90},${cy - 155} ${cx - 115},${cy - 80} Z" fill="${c}"/>` +
      `<path d="M${cx - 120},${cy - 50} Q${cx - 135},${cy + 30} ${cx - 120},${cy + 90} Q${cx - 110},${cy + 110} ${cx - 95},${cy + 100}" fill="${c}" stroke="${hairShadow}" stroke-width="1"/>` +
      `<path d="M${cx + 120},${cy - 50} Q${cx + 135},${cy + 30} ${cx + 120},${cy + 90} Q${cx + 110},${cy + 110} ${cx + 95},${cy + 100}" fill="${c}" stroke="${hairShadow}" stroke-width="1"/>`;
    case 'ponytail':
      return `<path d="M${cx - 115},${cy - 70} Q${cx - 120},${cy - 160} ${cx - 40},${cy - 175} Q${cx},${cy - 185} ${cx + 40},${cy - 175} Q${cx + 120},${cy - 160} ${cx + 115},${cy - 70} L${cx + 100},${cy - 100} Q${cx + 80},${cy - 150} ${cx},${cy - 155} Q${cx - 80},${cy - 150} ${cx - 100},${cy - 100} Z" fill="${c}"/>` +
      `<path d="M${cx + 60},${cy - 145} Q${cx + 100},${cy - 130} ${cx + 120},${cy - 80} Q${cx + 140},${cy - 30} ${cx + 115},${cy + 20}" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round"/>`;
    case 'bun':
      return `<path d="M${cx - 115},${cy - 70} Q${cx - 120},${cy - 160} ${cx - 40},${cy - 175} Q${cx},${cy - 185} ${cx + 40},${cy - 175} Q${cx + 120},${cy - 160} ${cx + 115},${cy - 70} L${cx + 100},${cy - 100} Q${cx + 80},${cy - 150} ${cx},${cy - 155} Q${cx - 80},${cy - 150} ${cx - 100},${cy - 100} Z" fill="${c}"/>` +
      `<circle cx="${cx}" cy="${cy - 175}" r="25" fill="${c}"/>` +
      `<circle cx="${cx}" cy="${cy - 175}" r="18" fill="${hairShadow}" opacity="0.3"/>`;
    case 'mohawk':
      return `<path d="M${cx - 15},${cy - 100} Q${cx},${cy - 210} ${cx + 15},${cy - 100}" fill="${c}"/>` +
      `<path d="M${cx - 12},${cy - 110} Q${cx},${cy - 195} ${cx + 12},${cy - 110}" fill="${lighten(c, 30)}" opacity="0.4"/>`;
    case 'curly':
      let circles = '';
      for (let i = 0; i < 25; i++) {
        const angle = (i / 25) * Math.PI * 2;
        const r = 110 + Math.sin(i * 1.5) * 15;
        const x = cx + Math.cos(angle) * r;
        const y = cy - 80 + Math.sin(angle) * (r * 0.7);
        if (y < cy - 110) {
          circles += `<circle cx="${x}" cy="${y}" r="${10 + Math.sin(i) * 3}" fill="${i % 3 === 0 ? hairShadow : c}"/>`;
        }
      }
      return circles;
    case 'afro':
      return `<circle cx="${cx}" cy="${cy - 95}" r="130" fill="${c}"/>` +
      `<circle cx="${cx - 20}" cy="${cy - 110}" r="120" fill="${hairShadow}" opacity="0.2"/>` +
      `<circle cx="${cx + 30}" cy="${cy - 80}" r="110" fill="${c}" opacity="0.5"/>`;
    case 'spiky':
      let spikes = '';
      for (let i = 0; i < 9; i++) {
        const angle = (i / 9) * Math.PI + Math.PI;
        const x1 = cx + Math.cos(angle) * 60;
        const y1 = cy - 100 + Math.sin(angle) * 40;
        const x2 = cx + Math.cos(angle) * 140;
        const y2 = cy - 100 + Math.sin(angle) * 100;
        spikes += `<polygon points="${x1 - 8},${y1} ${x2},${y2} ${x1 + 8},${y1}" fill="${i % 2 === 0 ? c : hairShadow}"/>`;
      }
      return spikes + `<path d="M${cx - 60},${cy - 110} Q${cx},${cy - 145} ${cx + 60},${cy - 110}" fill="${c}"/>`;
    case 'wavy':
      return `<path d="M${cx - 120},${cy - 50} Q${cx - 130},${cy - 165} ${cx - 50},${cy - 180} Q${cx},${cy - 190} ${cx + 50},${cy - 180} Q${cx + 130},${cy - 165} ${cx + 120},${cy - 50}" fill="${c}"/>` +
      `<path d="M${cx - 120},${cy - 50} Q${cx - 135},${cy + 10} ${cx - 115},${cy + 50} Q${cx - 100},${cy + 80} ${cx - 120},${cy + 90}" fill="none" stroke="${c}" stroke-width="20" stroke-linecap="round"/>` +
      `<path d="M${cx + 120},${cy - 50} Q${cx + 135},${cy + 10} ${cx + 115},${cy + 50} Q${cx + 100},${cy + 80} ${cx + 120},${cy + 90}" fill="none" stroke="${c}" stroke-width="20" stroke-linecap="round"/>`;
    case 'bob':
      return `<path d="M${cx - 120},${cy - 60} Q${cx - 130},${cy - 165} ${cx - 50},${cy - 180} Q${cx},${cy - 190} ${cx + 50},${cy - 180} Q${cx + 130},${cy - 165} ${cx + 120},${cy - 60} L${cx + 125},${cy + 10} Q${cx + 130},${cy + 40} ${cx + 110},${cy + 50} L${cx - 110},${cy + 50} Q${cx - 130},${cy + 40} ${cx - 125},${cy + 10} Z" fill="${c}"/>` +
      `<path d="M${cx - 110},${cy + 50} Q${cx - 105},${cy + 55} ${cx - 115},${cy + 55}" fill="${c}"/>` +
      `<path d="M${cx + 110},${cy + 50} Q${cx + 105},${cy + 55} ${cx + 115},${cy + 55}" fill="${c}"/>`;
    case 'pixie':
      return `<path d="M${cx - 110},${cy - 60} Q${cx - 120},${cy - 160} ${cx - 30},${cy - 180} Q${cx + 10},${cy - 185} ${cx + 60},${cy - 170} Q${cx + 115},${cy - 150} ${cx + 110},${cy - 80}" fill="${c}"/>` +
      `<path d="M${cx + 60},${cy - 170} Q${cx + 100},${cy - 140} ${cx + 120},${cy - 80} Q${cx + 130},${cy - 40} ${cx + 115},${cy - 20}" fill="${c}" stroke="${hairShadow}" stroke-width="1"/>`;
    case 'side-swept':
      return `<path d="M${cx - 115},${cy - 70} Q${cx - 120},${cy - 160} ${cx - 40},${cy - 175} Q${cx},${cy - 185} ${cx + 40},${cy - 175} Q${cx + 120},${cy - 160} ${cx + 115},${cy - 70}" fill="${c}"/>` +
      `<path d="M${cx - 115},${cy - 70} Q${cx - 140},${cy - 30} ${cx - 120},${cy + 20} Q${cx - 100},${cy + 40} ${cx - 80},${cy + 10}" fill="${c}" stroke="${hairShadow}" stroke-width="1"/>` +
      `<path d="M${cx + 80},${cy - 150} Q${cx + 120},${cy - 120} ${cx + 100},${cy - 80}" fill="${hairShadow}" opacity="0.3"/>`;
    default:
      return '';
  }
}

function renderFacialHair(a: AvatarState): string {
  const cx = 200, cy = 280;
  const c = a.facialHairColor;
  if (a.facialHair === 'none') return '';

  switch (a.facialHair) {
    case 'stubble':
      let dots = '';
      for (let i = 0; i < 40; i++) {
        const x = cx + (Math.random() - 0.5) * 120;
        const y = cy + (Math.random() - 0.5) * 50 + 10;
        dots += `<circle cx="${x}" cy="${y}" r="0.8" fill="${c}" opacity="0.5"/>`;
      }
      return dots;
    case 'goatee':
      return `<path d="M${cx - 15},${cy + 5} Q${cx},${cy + 45} ${cx + 15},${cy + 5}" fill="${c}" opacity="0.8"/>`;
    case 'mustache':
      return `<path d="M${cx - 25},${cy - 8} Q${cx - 15},${cy + 6} ${cx},${cy - 2} Q${cx + 15},${cy + 6} ${cx + 25},${cy - 8}" fill="${c}" opacity="0.85"/>`;
    case 'full':
      return `<path d="M${cx - 50},${cy - 5} Q${cx - 60},${cy + 40} ${cx - 30},${cy + 55} Q${cx},${cy + 65} ${cx + 30},${cy + 55} Q${cx + 60},${cy + 40} ${cx + 50},${cy - 5}" fill="${c}" opacity="0.7"/>` +
        `<path d="M${cx - 25},${cy - 8} Q${cx - 15},${cy + 6} ${cx},${cy - 2} Q${cx + 15},${cy + 6} ${cx + 25},${cy - 8}" fill="${c}" opacity="0.85"/>`;
    case 'circle':
      return `<path d="M${cx - 40},${cy} Q${cx - 50},${cy + 50} ${cx},${cy + 60} Q${cx + 50},${cy + 50} ${cx + 40},${cy}" fill="none" stroke="${c}" stroke-width="8" opacity="0.7"/>` +
        `<path d="M${cx - 25},${cy - 8} Q${cx - 15},${cy + 6} ${cx},${cy - 2} Q${cx + 15},${cy + 6} ${cx + 25},${cy - 8}" fill="${c}" opacity="0.85"/>`;
    case 'handlebar':
      return `<path d="M${cx - 25},${cy - 8} Q${cx - 40},${cy + 2} ${cx - 55},${cy - 8}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M${cx + 25},${cy - 8} Q${cx + 40},${cy + 2} ${cx + 55},${cy - 8}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M${cx - 20},${cy - 4} Q${cx},${cy + 8} ${cx + 20},${cy - 4}" fill="${c}" opacity="0.85"/>`;
    case 'wizard':
      return `<path d="M${cx - 55},${cy - 5} Q${cx - 65},${cy + 50} ${cx - 30},${cy + 80} Q${cx},${cy + 100} ${cx + 30},${cy + 80} Q${cx + 65},${cy + 50} ${cx + 55},${cy - 5}" fill="${c}" opacity="0.75"/>` +
        `<path d="M${cx - 25},${cy - 8} Q${cx - 15},${cy + 6} ${cx},${cy - 2} Q${cx + 15},${cy + 6} ${cx + 25},${cy - 8}" fill="${c}" opacity="0.85"/>`;
    default:
      return '';
  }
}

function renderAccessory(a: AvatarState): string {
  const cx = 200, cy = 195;
  const c = a.accessoryColor;
  const sp = 38 * a.eyeSpacing;

  switch (a.accessory) {
    case 'glasses':
      return `<rect x="${cx - sp - 22}" y="${cy - 14}" width="44" height="30" rx="6" fill="none" stroke="${c}" stroke-width="2.5"/>` +
        `<rect x="${cx + sp - 22}" y="${cy - 14}" width="44" height="30" rx="6" fill="none" stroke="${c}" stroke-width="2.5"/>` +
        `<line x1="${cx - sp + 22}" y1="${cy}" x2="${cx + sp - 22}" y2="${cy}" stroke="${c}" stroke-width="2"/>` +
        `<line x1="${cx - sp - 22}" y1="${cy + 2}" x2="${cx - sp - 35}" y2="${cy - 5}" stroke="${c}" stroke-width="2"/>` +
        `<line x1="${cx + sp + 22}" y1="${cy + 2}" x2="${cx + sp + 35}" y2="${cy - 5}" stroke="${c}" stroke-width="2"/>`;
    case 'sunglasses':
      return `<rect x="${cx - sp - 24}" y="${cy - 16}" width="48" height="32" rx="8" fill="${c}" opacity="0.85" stroke="${darken(c, 30)}" stroke-width="1.5"/>` +
        `<rect x="${cx + sp - 24}" y="${cy - 16}" width="48" height="32" rx="8" fill="${c}" opacity="0.85" stroke="${darken(c, 30)}" stroke-width="1.5"/>` +
        `<line x1="${cx - sp + 24}" y1="${cy - 2}" x2="${cx + sp - 24}" y2="${cy - 2}" stroke="${darken(c, 40)}" stroke-width="2.5"/>` +
        `<line x1="${cx - sp - 24}" y1="${cy}" x2="${cx - sp - 38}" y2="${cy - 8}" stroke="${darken(c, 30)}" stroke-width="2.5"/>` +
        `<line x1="${cx + sp + 24}" y1="${cy}" x2="${cx + sp + 38}" y2="${cy - 8}" stroke="${darken(c, 30)}" stroke-width="2.5"/>` +
        `<rect x="${cx - sp - 20}" y="${cy - 12}" width="20" height="6" rx="3" fill="white" opacity="0.2"/>` +
        `<rect x="${cx + sp - 20}" y="${cy - 12}" width="20" height="6" rx="3" fill="white" opacity="0.2"/>`;
    case 'round-glasses':
      return `<circle cx="${cx - sp}" cy="${cy}" r="22" fill="none" stroke="${c}" stroke-width="2.5"/>` +
        `<circle cx="${cx + sp}" cy="${cy}" r="22" fill="none" stroke="${c}" stroke-width="2.5"/>` +
        `<line x1="${cx - sp + 22}" y1="${cy}" x2="${cx + sp - 22}" y2="${cy}" stroke="${c}" stroke-width="2"/>` +
        `<line x1="${cx - sp - 22}" y1="${cy}" x2="${cx - sp - 35}" y2="${cy - 6}" stroke="${c}" stroke-width="2"/>` +
        `<line x1="${cx + sp + 22}" y1="${cy}" x2="${cx + sp + 35}" y2="${cy - 6}" stroke="${c}" stroke-width="2"/>`;
    case 'earrings':
      return `<circle cx="${cx - 112}" cy="${cy + 10}" r="5" fill="${c}" stroke="${darken(c, 20)}" stroke-width="1"/>` +
        `<circle cx="${cx + 112}" cy="${cy + 10}" r="5" fill="${c}" stroke="${darken(c, 20)}" stroke-width="1"/>` +
        `<circle cx="${cx - 112}" cy="${cy + 22}" r="3" fill="${lighten(c, 40)}"/>` +
        `<circle cx="${cx + 112}" cy="${cy + 22}" r="3" fill="${lighten(c, 40)}"/>`;
    case 'headband':
      return `<path d="M${cx - 115},${cy - 80} Q${cx},${cy - 140} ${cx + 115},${cy - 80}" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>`;
    case 'bandana':
      return `<path d="M${cx - 115},${cy - 85} Q${cx},${cy - 130} ${cx + 115},${cy - 85}" fill="${c}" opacity="0.9"/>` +
        `<path d="M${cx - 115},${cy - 85} L${cx - 130},${cy - 65}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M${cx + 115},${cy - 85} L${cx + 130},${cy - 65}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
    case 'bow':
      return `<path d="M${cx + 60},${cy - 140} Q${cx + 40},${cy - 165} ${cx + 60},${cy - 175} Q${cx + 80},${cy - 165} ${cx + 60},${cy - 140}" fill="${c}"/>` +
        `<path d="M${cx + 60},${cy - 140} Q${cx + 80},${cy - 165} ${cx + 60},${cy - 175} Q${cx + 40},${cy - 165} ${cx + 60},${cy - 140}" fill="${lighten(c, 30)}" opacity="0.5"/>` +
        `<circle cx="${cx + 60}" cy="${cy - 158}" r="5" fill="${darken(c, 30)}"/>`;
    default:
      return '';
  }
}

function renderClothing(a: AvatarState): string {
  const cx = 200;
  const c = a.clothingColor;
  const top = 310;

  switch (a.clothingStyle) {
    case 'polo':
      return `<path d="M${cx - 80},${top} Q${cx - 100},${top + 60} ${cx - 120},${top + 100} L${cx - 120},${top + 100} L${cx + 120},${top + 100} L${cx + 120},${top + 100} Q${cx + 100},${top + 60} ${cx + 80},${top} L${cx + 30},${top - 15} L${cx + 15},${top + 5} L${cx},${top - 10} L${cx - 15},${top + 5} L${cx - 30},${top - 15} Z" fill="${c}"/>` +
        `<line x1="${cx}" y1="${top - 10}" x2="${cx}" y2="${top + 25}" stroke="${darken(c, 30)}" stroke-width="1.5"/>` +
        `<circle cx="${cx}" cy="${top + 10}" r="2" fill="${darken(c, 40)}"/>` +
        `<circle cx="${cx}" cy="${top + 20}" r="2" fill="${darken(c, 40)}"/>`;
    case 'hoodie':
      return `<path d="M${cx - 85},${top} Q${cx - 105},${top + 60} ${cx - 125},${top + 100} L${cx + 125},${top + 100} Q${cx + 105},${top + 60} ${cx + 85},${top} L${cx + 35},${top - 10} L${cx},${top + 5} L${cx - 35},${top - 10} Z" fill="${c}"/>` +
        `<path d="M${cx - 25},${top - 5} Q${cx},${top + 15} ${cx + 25},${top - 5}" fill="none" stroke="${darken(c, 20)}" stroke-width="2"/>` +
        `<path d="M${cx - 30},${top + 5} L${cx - 20},${top + 35} L${cx + 20},${top + 35} L${cx + 30},${top + 5}" fill="${darken(c, 10)}" opacity="0.5"/>`;
    case 'suit':
      return `<path d="M${cx - 80},${top} Q${cx - 100},${top + 60} ${cx - 120},${top + 100} L${cx + 120},${top + 100} Q${cx + 100},${top + 60} ${cx + 80},${top} L${cx + 40},${top - 12} L${cx + 5},${top + 8} L${cx},${top - 8} L${cx - 5},${top + 8} L${cx - 40},${top - 12} Z" fill="${c}"/>` +
        `<path d="M${cx - 40},${top - 12} L${cx - 5},${top + 8} L${cx},${top - 8} L${cx + 5},${top + 8} L${cx + 40},${top - 12}" fill="${darken(c, 15)}"/>` +
        `<path d="M${cx},${top - 8} L${cx - 3},${top + 35}" stroke="white" stroke-width="2"/>` +
        `<path d="M${cx - 35},${top + 20} L${cx - 30},${top + 25}" stroke="${darken(c, 20)}" stroke-width="3" stroke-linecap="round"/>`;
    case 'vneck':
      return `<path d="M${cx - 80},${top} Q${cx - 100},${top + 60} ${cx - 120},${top + 100} L${cx + 120},${top + 100} Q${cx + 100},${top + 60} ${cx + 80},${top} L${cx + 30},${top - 12} L${cx},${top + 18} L${cx - 30},${top - 12} Z" fill="${c}"/>`;
    case 'turtleneck':
      return `<rect x="${cx - 30}" y="${top - 25}" width="60" height="20" rx="5" fill="${darken(c, 15)}"/>` +
        `<path d="M${cx - 80},${top} Q${cx - 100},${top + 60} ${cx - 120},${top + 100} L${cx + 120},${top + 100} Q${cx + 100},${top + 60} ${cx + 80},${top} L${cx + 30},${top - 12} L${cx - 30},${top - 12} Z" fill="${c}"/>`;
    case 'tanktop':
      return `<path d="M${cx - 55},${top - 5} Q${cx - 80},${top + 50} ${cx - 100},${top + 100} L${cx + 100},${top + 100} Q${cx + 80},${top + 50} ${cx + 55},${top - 5} L${cx + 40},${top - 10} L${cx + 30},${top + 5} L${cx - 30},${top + 5} L${cx - 40},${top - 10} Z" fill="${c}"/>`;
    default: // tshirt
      return `<path d="M${cx - 80},${top} Q${cx - 100},${top + 60} ${cx - 120},${top + 100} L${cx + 120},${top + 100} Q${cx + 100},${top + 60} ${cx + 80},${top} L${cx + 35},${top - 10} L${cx},${top + 5} L${cx - 35},${top - 10} Z" fill="${c}"/>`;
  }
}

export function renderAvatar(a: AvatarState): string {
  const headShadow = darken(a.skinTone, 30);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
    <defs>
      <radialGradient id="headHighlight" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="${lighten(a.skinTone, 30)}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${a.skinTone}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="bgGlow" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="white" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="faceClip">
        <path d="${getFacePath(a.faceShape)}"/>
      </clipPath>
    </defs>

    <!-- Background -->
    <rect width="400" height="400" fill="${a.bgColor}" rx="0"/>
    <rect width="400" height="400" fill="url(#bgGlow)"/>

    <!-- Clothing -->
    ${renderClothing(a)}

    <!-- Neck -->
    <rect x="185" y="300" width="30" height="30" rx="5" fill="${a.skinTone}"/>

    <!-- Head -->
    <path d="${getFacePath(a.faceShape)}" fill="${a.skinTone}" stroke="${headShadow}" stroke-width="0.5"/>
    <path d="${getFacePath(a.faceShape)}" fill="url(#headHighlight)"/>

    <!-- Ears -->
    <ellipse cx="90" cy="200" rx="14" ry="20" fill="${a.skinTone}" stroke="${headShadow}" stroke-width="0.5"/>
    <ellipse cx="90" cy="200" rx="8" ry="14" fill="${darken(a.skinTone, 15)}" opacity="0.4"/>
    <ellipse cx="310" cy="200" rx="14" ry="20" fill="${a.skinTone}" stroke="${headShadow}" stroke-width="0.5"/>
    <ellipse cx="310" cy="200" rx="8" ry="14" fill="${darken(a.skinTone, 15)}" opacity="0.4"/>

    <!-- Hair (behind face layer) -->
    ${(a.hairStyle === 'long' || a.hairStyle === 'wavy') ? renderHair(a) : ''}

    <!-- Eyes -->
    ${renderEyes(a)}

    <!-- Eyebrows -->
    ${renderEyebrows(a)}

    <!-- Nose -->
    ${renderNose(a)}

    <!-- Mouth -->
    ${renderMouth(a)}

    <!-- Hair (front layer) -->
    ${(a.hairStyle !== 'long' && a.hairStyle !== 'wavy') ? renderHair(a) : ''}

    <!-- Facial Hair -->
    ${renderFacialHair(a)}

    <!-- Accessory -->
    ${renderAccessory(a)}
  </svg>`;
}
