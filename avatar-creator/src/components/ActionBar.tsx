import { useAvatarStore } from '../store/avatarStore';
import { renderAvatar } from '../utils/avatarRenderer';
import { motion } from 'framer-motion';

export function ActionBar() {
  const avatar = useAvatarStore((s) => s.avatar);
  const resetAvatar = useAvatarStore((s) => s.resetAvatar);
  const undo = useAvatarStore((s) => s.undo);
  const redo = useAvatarStore((s) => s.redo);
  const canUndo = useAvatarStore((s) => s.canUndo);
  const canRedo = useAvatarStore((s) => s.canRedo);
  const exportJSON = useAvatarStore((s) => s.exportJSON);
  const importJSON = useAvatarStore((s) => s.importJSON);
  const loadPreset = useAvatarStore((s) => s.loadPreset);

  const handleRandomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randAvatar = {
      ...avatar,
      name: avatar.name,
      faceShape: pick(['oval', 'round', 'square', 'heart', 'long']),
      skinTone: pick(['#FDDBB4', '#F5C7A1', '#E8AD82', '#D49B6A', '#C08852', '#A67640', '#8C6430', '#6B4C22', '#FCE4D6']),
      eyeShape: pick(['round', 'almond', 'wide', 'narrow', 'cat', 'droopy']),
      eyeColor: pick(['#4a3520', '#6b4c22', '#2e7d32', '#1565c0', '#4a148c', '#37474f', '#00838f']),
      eyeSize: 0.7 + Math.random() * 0.8,
      eyeSpacing: 0.7 + Math.random() * 0.6,
      eyebrowShape: pick(['natural', 'arched', 'straight', 'angled', 'thin', 'thick']),
      eyebrowThickness: 0.5 + Math.random() * 1.5,
      eyebrowColor: pick(['#1a1a1a', '#3d2b1f', '#6b4423', '#8b6914', '#95a5a6']),
      noseShape: pick(['small', 'medium', 'large', 'pointed', 'round', 'flat']),
      noseSize: 0.6 + Math.random() * 1.0,
      mouthShape: pick(['smile', 'neutral', 'grin', 'smirk', 'open', 'pout', 'wide']),
      mouthColor: pick(['#c0392b', '#e74c3c', '#d35400', '#e67e22', '#8b4513', '#cd5c5c', '#db7093']),
      mouthSize: 0.6 + Math.random() * 1.0,
      hairStyle: pick(['none', 'buzz', 'short', 'medium', 'long', 'ponytail', 'bun', 'mohawk', 'curly', 'afro', 'spiky', 'wavy', 'bob', 'pixie', 'side-swept']),
      hairColor: pick(['#1a1a1a', '#3d2b1f', '#6b4423', '#8b6914', '#b8860b', '#d4a017', '#f5d033', '#e8a0bf', '#c0392b', '#8e44ad', '#2980b9', '#27ae60', '#f39c12', '#ecf0f1', '#95a5a6']),
      facialHair: pick(['none', 'stubble', 'goatee', 'mustache', 'full', 'circle', 'handlebar', 'wizard']),
      facialHairColor: pick(['#1a1a1a', '#3d2b1f', '#6b4423', '#95a5a6']),
      accessory: pick(['none', 'glasses', 'sunglasses', 'round-glasses', 'earrings', 'headband', 'bandana', 'bow']),
      accessoryColor: pick(['#37474f', '#1a1a1a', '#8b6914', '#c0392b', '#1565c0', '#6a1b9a', '#ecf0f1']),
      clothingStyle: pick(['tshirt', 'polo', 'hoodie', 'suit', 'vneck', 'turtleneck', 'tanktop']),
      clothingColor: pick(['#1565c0', '#c62828', '#2e7d32', '#f57f17', '#6a1b9a', '#00838f', '#d84315', '#37474f', '#212121', '#455a64']),
    };
    loadPreset(randAvatar);
  };

  const handleExportPNG = () => {
    const svgMarkup = renderAvatar(avatar);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 800, 800);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `${avatar.name.replace(/[^a-z0-9]/gi, '_') || 'avatar'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  const handleExportJSON = () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `${avatar.name.replace(/[^a-z0-9]/gi, '_') || 'avatar'}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (importJSON(text)) {
          alert('Avatar imported successfully!');
        } else {
          alert('Invalid avatar file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel mx-3 mb-3 mt-0 px-4 py-3 flex items-center justify-between shrink-0 z-10"
      style={{ borderRadius: '20px' }}
    >
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={undo}
          disabled={!canUndo()}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={redo}
          disabled={!canRedo()}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </motion.button>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRandomize}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Randomize (R)"
        >
          🎲 Random
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={resetAvatar}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Reset"
        >
          🔄 Reset
        </motion.button>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExportJSON}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Export JSON"
        >
          📋 JSON
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleImportJSON}
          className="aero-btn px-3 py-1.5 text-xs"
          title="Import JSON"
        >
          📂 Import
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleExportPNG}
          className="aero-btn-primary px-4 py-1.5 text-xs"
          title="Export PNG"
        >
          📸 Export PNG
        </motion.button>
      </div>
    </motion.div>
  );
}
