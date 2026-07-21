import { useAvatarStore } from '../store/avatarStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SKIN_TONES, HAIR_COLORS, EYE_COLORS, MOUTH_COLORS, CLOTHING_COLORS,
  FACE_SHAPES, EYE_SHAPES, EYEBROW_SHAPES, NOSE_SHAPES, MOUTH_SHAPES,
  HAIR_STYLES, FACIAL_HAIR_STYLES, ACCESSORIES, CLOTHING_STYLES,
  PRESETS, AvatarKey,
} from '../types/avatar';

const BG_COLORS = [
  { color: '#e8f4fd', gradient: 'linear-gradient(180deg, #e8f4fd 0%, #b3e0ff 100%)' },
  { color: '#fce4ec', gradient: 'linear-gradient(180deg, #fce4ec 0%, #f8bbd0 100%)' },
  { color: '#e8f5e9', gradient: 'linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)' },
  { color: '#fff3e0', gradient: 'linear-gradient(180deg, #fff3e0 0%, #ffe0b2 100%)' },
  { color: '#f3e5f5', gradient: 'linear-gradient(180deg, #f3e5f5 0%, #e1bee7 100%)' },
  { color: '#e0f7fa', gradient: 'linear-gradient(180deg, #e0f7fa 0%, #b2ebf2 100%)' },
  { color: '#fff8e1', gradient: 'linear-gradient(180deg, #fff8e1 0%, #ffecb3 100%)' },
  { color: '#eceff1', gradient: 'linear-gradient(180deg, #eceff1 0%, #cfd8dc 100%)' },
  { color: '#1a1a2e', gradient: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' },
  { color: '#0d1117', gradient: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">{title}</div>
      {children}
    </div>
  );
}

function ChipRow({ items, selected, onSelect, displayFn }: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  displayFn?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className={`option-chip ${selected === item ? 'active' : ''}`}
        >
          {displayFn ? displayFn(item) : item}
        </button>
      ))}
    </div>
  );
}

function ColorRow({ colors, selected, onSelect }: {
  colors: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`color-swatch ${selected === c ? 'active' : ''}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs font-medium opacity-60 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="aero-slider flex-1"
      />
      <span className="text-[10px] font-mono opacity-40 w-8 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function PresetRow() {
  const loadPreset = useAvatarStore((s) => s.loadPreset);
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.name}
          onClick={() => loadPreset(p.state)}
          className="option-chip"
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function FacePanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Presets">
        <PresetRow />
      </Section>
      <Section title="Face Shape">
        <ChipRow items={FACE_SHAPES} selected={avatar.faceShape} onSelect={(v) => setAvatar({ faceShape: v })} />
      </Section>
      <Section title="Skin Tone">
        <ColorRow colors={SKIN_TONES} selected={avatar.skinTone} onSelect={(v) => setAvatar({ skinTone: v })} />
      </Section>
    </>
  );
}

function EyesPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Eye Shape">
        <ChipRow items={EYE_SHAPES} selected={avatar.eyeShape} onSelect={(v) => setAvatar({ eyeShape: v })} />
      </Section>
      <Section title="Eye Color">
        <ColorRow colors={EYE_COLORS} selected={avatar.eyeColor} onSelect={(v) => setAvatar({ eyeColor: v })} />
      </Section>
      <Section title="Adjustments">
        <SliderRow label="Size" value={avatar.eyeSize} min={0.5} max={1.8} step={0.1} onChange={(v) => setAvatar({ eyeSize: v })} />
        <SliderRow label="Spacing" value={avatar.eyeSpacing} min={0.6} max={1.4} step={0.1} onChange={(v) => setAvatar({ eyeSpacing: v })} />
      </Section>
    </>
  );
}

function EyebrowsPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Shape">
        <ChipRow items={EYEBROW_SHAPES} selected={avatar.eyebrowShape} onSelect={(v) => setAvatar({ eyebrowShape: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={HAIR_COLORS} selected={avatar.eyebrowColor} onSelect={(v) => setAvatar({ eyebrowColor: v })} />
      </Section>
      <Section title="Thickness">
        <SliderRow label="Width" value={avatar.eyebrowThickness} min={0.5} max={2.5} step={0.1} onChange={(v) => setAvatar({ eyebrowThickness: v })} />
      </Section>
    </>
  );
}

function NosePanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Shape">
        <ChipRow items={NOSE_SHAPES} selected={avatar.noseShape} onSelect={(v) => setAvatar({ noseShape: v })} />
      </Section>
      <Section title="Size">
        <SliderRow label="Scale" value={avatar.noseSize} min={0.5} max={2} step={0.1} onChange={(v) => setAvatar({ noseSize: v })} />
      </Section>
    </>
  );
}

function MouthPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Shape">
        <ChipRow items={MOUTH_SHAPES} selected={avatar.mouthShape} onSelect={(v) => setAvatar({ mouthShape: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={MOUTH_COLORS} selected={avatar.mouthColor} onSelect={(v) => setAvatar({ mouthColor: v })} />
      </Section>
      <Section title="Size">
        <SliderRow label="Scale" value={avatar.mouthSize} min={0.5} max={2} step={0.1} onChange={(v) => setAvatar({ mouthSize: v })} />
      </Section>
    </>
  );
}

function HairPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Style">
        <ChipRow items={HAIR_STYLES} selected={avatar.hairStyle} onSelect={(v) => setAvatar({ hairStyle: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={HAIR_COLORS} selected={avatar.hairColor} onSelect={(v) => setAvatar({ hairColor: v })} />
      </Section>
    </>
  );
}

function FacialHairPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Style">
        <ChipRow items={FACIAL_HAIR_STYLES} selected={avatar.facialHair} onSelect={(v) => setAvatar({ facialHair: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={HAIR_COLORS} selected={avatar.facialHairColor} onSelect={(v) => setAvatar({ facialHairColor: v })} />
      </Section>
    </>
  );
}

function AccessoriesPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Type">
        <ChipRow items={ACCESSORIES} selected={avatar.accessory} onSelect={(v) => setAvatar({ accessory: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={CLOTHING_COLORS} selected={avatar.accessoryColor} onSelect={(v) => setAvatar({ accessoryColor: v })} />
      </Section>
    </>
  );
}

function ClothingPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Style">
        <ChipRow items={CLOTHING_STYLES} selected={avatar.clothingStyle} onSelect={(v) => setAvatar({ clothingStyle: v })} />
      </Section>
      <Section title="Color">
        <ColorRow colors={CLOTHING_COLORS} selected={avatar.clothingColor} onSelect={(v) => setAvatar({ clothingColor: v })} />
      </Section>
    </>
  );
}

function BackgroundPanel() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  return (
    <>
      <Section title="Background">
        <div className="grid grid-cols-5 gap-2">
          {BG_COLORS.map((bg) => (
            <button
              key={bg.color}
              onClick={() => setAvatar({ bgColor: bg.color, bgGradient: bg.gradient })}
              className={`w-10 h-10 rounded-xl transition-all duration-150 ${
                avatar.bgColor === bg.color ? 'ring-2 ring-blue-500 ring-offset-2 scale-110' : 'hover:scale-105'
              }`}
              style={{ background: bg.gradient, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

const PANELS: Record<string, () => JSX.Element> = {
  face: FacePanel,
  eyes: EyesPanel,
  eyebrows: EyebrowsPanel,
  nose: NosePanel,
  mouth: MouthPanel,
  hair: HairPanel,
  facialHair: FacialHairPanel,
  accessories: AccessoriesPanel,
  clothing: ClothingPanel,
  background: BackgroundPanel,
};

export function ControlPanel() {
  const selectedCategory = useAvatarStore((s) => s.selectedCategory);
  const darkMode = useAvatarStore((s) => s.darkMode);
  const Panel = PANELS[selectedCategory] || FacePanel;

  return (
    <motion.div
      initial={{ x: 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={`glass-panel w-[280px] shrink-0 p-4 overflow-y-auto scrollbar-thin ${
        darkMode ? 'dark-glass-panel' : ''
      }`}
      style={{ borderRadius: '20px' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Panel />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
