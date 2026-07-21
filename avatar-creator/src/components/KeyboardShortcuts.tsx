import { useEffect } from 'react';
import { useAvatarStore } from '../store/avatarStore';

export function KeyboardShortcuts() {
  const undo = useAvatarStore((s) => s.undo);
  const redo = useAvatarStore((s) => s.redo);
  const resetAvatar = useAvatarStore((s) => s.resetAvatar);
  const toggleDarkMode = useAvatarStore((s) => s.toggleDarkMode);
  const setSelectedCategory = useAvatarStore((s) => s.setSelectedCategory);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
        resetAvatar();
      }
      if (e.key === 'd') {
        toggleDarkMode();
      }
      const catMap: Record<string, string> = {
        '1': 'face', '2': 'eyes', '3': 'eyebrows', '4': 'nose', '5': 'mouth',
        '6': 'hair', '7': 'facialHair', '8': 'accessories', '9': 'clothing', '0': 'background',
      };
      if (catMap[e.key]) {
        setSelectedCategory(catMap[e.key]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, resetAvatar, toggleDarkMode, setSelectedCategory]);

  return null;
}
