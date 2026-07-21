import { useAvatarStore } from '../store/avatarStore';
import { motion } from 'framer-motion';

export function TopBar() {
  const avatar = useAvatarStore((s) => s.avatar);
  const setAvatar = useAvatarStore((s) => s.setAvatar);
  const darkMode = useAvatarStore((s) => s.darkMode);
  const toggleDarkMode = useAvatarStore((s) => s.toggleDarkMode);

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-panel mx-3 mt-3 mb-0 px-5 py-3 flex items-center justify-between shrink-0 z-10"
      style={{ borderRadius: '20px' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'linear-gradient(135deg, #4da6ff, #2196f3)', boxShadow: '0 2px 8px rgba(33,150,243,0.3)' }}>
          <span className="text-white font-bold text-sm">A</span>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight" style={{ color: darkMode ? '#e3f2fd' : '#1565c0' }}>
            AeroAvatar
          </h1>
          <p className="text-[10px] opacity-50 font-medium">Create Your Avatar</p>
        </div>
      </div>

      <div className="flex-1 max-w-xs mx-6">
        <input
          type="text"
          value={avatar.name}
          onChange={(e) => setAvatar({ name: e.target.value })}
          className={`w-full px-4 py-2 rounded-xl text-sm font-semibold text-center outline-none transition-all duration-200 ${
            darkMode
              ? 'bg-[#1a2a40]/60 border border-white/10 text-white focus:border-[#64b5f6]/40'
              : 'bg-white/60 border border-white/40 text-gray-700 focus:border-[#2196f3]/40'
          }`}
          style={{ backdropFilter: 'blur(10px)' }}
          placeholder="Avatar Name"
        />
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleDarkMode}
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all duration-200 ${
            darkMode
              ? 'bg-[#1a2a40]/60 border border-white/10 hover:border-[#64b5f6]/30 text-yellow-400'
              : 'bg-white/60 border border-white/40 hover:border-[#2196f3]/30 text-gray-500'
          }`}
          title="Toggle Dark Mode"
        >
          {darkMode ? '☀️' : '🌙'}
        </motion.button>
        <div className="text-[10px] opacity-40 font-medium hidden sm:block">
          v1.0
        </div>
      </div>
    </motion.div>
  );
}
