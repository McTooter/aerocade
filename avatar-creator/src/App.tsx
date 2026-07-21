import { useEffect } from 'react';
import { useAvatarStore } from './store/avatarStore';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { AvatarPreview } from './components/AvatarPreview';
import { ControlPanel } from './components/ControlPanel';
import { ActionBar } from './components/ActionBar';
import { AmbientBackground } from './components/AmbientBackground';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';

export default function App() {
  const darkMode = useAvatarStore((s) => s.darkMode);
  const loadFromStorage = useAvatarStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300 ${
      darkMode ? 'bg-[#0f1724] text-gray-200' : 'bg-gradient-to-br from-[#e8f4fd] via-[#d4ecfb] to-[#c0e3f8] text-gray-800'
    }`}>
      <AmbientBackground />
      <KeyboardShortcuts />
      <TopBar />
      <div className="flex flex-1 min-h-0 gap-3 p-3 pt-0">
        <Sidebar />
        <AvatarPreview />
        <ControlPanel />
      </div>
      <ActionBar />
    </div>
  );
}
