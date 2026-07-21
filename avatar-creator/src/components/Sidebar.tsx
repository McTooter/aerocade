import { useAvatarStore } from '../store/avatarStore';
import { motion } from 'framer-motion';

const CATEGORIES = [
  { id: 'face', icon: '😊', label: 'Face' },
  { id: 'eyes', icon: '👁', label: 'Eyes' },
  { id: 'eyebrows', icon: '🤨', label: 'Eyebrows' },
  { id: 'nose', icon: '👃', label: 'Nose' },
  { id: 'mouth', icon: '👄', label: 'Mouth' },
  { id: 'hair', icon: '💇', label: 'Hair' },
  { id: 'facialHair', icon: '🧔', label: 'Facial Hair' },
  { id: 'accessories', icon: '👓', label: 'Accessories' },
  { id: 'clothing', icon: '👕', label: 'Clothing' },
  { id: 'background', icon: '🎨', label: 'Background' },
];

export function Sidebar() {
  const selectedCategory = useAvatarStore((s) => s.selectedCategory);
  const setSelectedCategory = useAvatarStore((s) => s.setSelectedCategory);
  const darkMode = useAvatarStore((s) => s.darkMode);

  return (
    <motion.div
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel w-[180px] shrink-0 p-3 flex flex-col gap-1 overflow-y-auto scrollbar-thin"
      style={{ borderRadius: '20px' }}
    >
      <div className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
        Categories
      </div>
      {CATEGORIES.map((cat, i) => (
        <motion.button
          key={cat.id}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15 + i * 0.03, duration: 0.3 }}
          onClick={() => setSelectedCategory(cat.id)}
          className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
        >
          <span className="text-base">{cat.icon}</span>
          <span>{cat.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
