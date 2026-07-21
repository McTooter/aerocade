import { useAvatarStore } from '../store/avatarStore';
import { renderAvatar } from '../utils/avatarRenderer';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

export function AvatarPreview() {
  const avatar = useAvatarStore((s) => s.avatar);
  const darkMode = useAvatarStore((s) => s.darkMode);

  const svgMarkup = useMemo(() => renderAvatar(avatar), [avatar]);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex items-center justify-center"
    >
      <div className={`relative rounded-aero-xl overflow-hidden ${
        darkMode
          ? 'shadow-[0_16px_48px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]'
          : 'shadow-aero-lg'
      }`}>
        <div className="absolute inset-0 z-10 pointer-events-none rounded-aero-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.03) 100%)',
          }}
        />
        <div
          id="avatar-svg-container"
          className="w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] lg:w-[480px] lg:h-[480px]"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
          style={{ borderRadius: '24px' }}
        />
      </div>
    </motion.div>
  );
}
