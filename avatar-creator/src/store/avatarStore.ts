import { create } from 'zustand';
import { AvatarState, HistoryEntry, createDefaultAvatar } from '../types/avatar';

const STORAGE_KEY = 'aero-avatar-autosave';
const MAX_HISTORY = 50;

interface AvatarStore {
  avatar: AvatarState;
  history: HistoryEntry[];
  historyIndex: number;
  darkMode: boolean;
  selectedCategory: string;

  setAvatar: (updates: Partial<AvatarState>) => void;
  resetAvatar: () => void;
  loadPreset: (state: AvatarState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  toggleDarkMode: () => void;
  setSelectedCategory: (cat: string) => void;
  exportJSON: () => string;
  importJSON: (json: string) => boolean;
  saveToStorage: () => void;
  loadFromStorage: () => boolean;
}

function pushHistory(state: AvatarState, history: HistoryEntry[], historyIndex: number): { history: HistoryEntry[]; historyIndex: number } {
  const newEntry: HistoryEntry = { state: { ...state }, timestamp: Date.now() };
  const trimmed = history.slice(0, historyIndex + 1);
  trimmed.push(newEntry);
  if (trimmed.length > MAX_HISTORY) trimmed.shift();
  return { history: trimmed, historyIndex: trimmed.length - 1 };
}

function loadSavedDarkMode(): boolean {
  try {
    const v = localStorage.getItem('aero-avatar-darkmode');
    return v === 'true';
  } catch { return false; }
}

export const useAvatarStore = create<AvatarStore>((set, get) => {
  const saved = loadSavedDarkMode();

  return {
    avatar: createDefaultAvatar(),
    history: [{ state: createDefaultAvatar(), timestamp: Date.now() }],
    historyIndex: 0,
    darkMode: saved,
    selectedCategory: 'face',

    setAvatar: (updates) => {
      set((s) => {
        const newAvatar = { ...s.avatar, ...updates };
        const h = pushHistory(newAvatar, s.history, s.historyIndex);
        return { avatar: newAvatar, ...h };
      });
      get().saveToStorage();
    },

    resetAvatar: () => {
      const def = createDefaultAvatar();
      set((s) => {
        const h = pushHistory(def, s.history, s.historyIndex);
        return { avatar: def, ...h };
      });
      get().saveToStorage();
    },

    loadPreset: (state) => {
      set((s) => {
        const h = pushHistory(state, s.history, s.historyIndex);
        return { avatar: { ...state }, ...h };
      });
      get().saveToStorage();
    },

    undo: () => {
      set((s) => {
        if (s.historyIndex <= 0) return {};
        const newIndex = s.historyIndex - 1;
        return { avatar: { ...s.history[newIndex].state }, historyIndex: newIndex };
      });
    },

    redo: () => {
      set((s) => {
        if (s.historyIndex >= s.history.length - 1) return {};
        const newIndex = s.historyIndex + 1;
        return { avatar: { ...s.history[newIndex].state }, historyIndex: newIndex };
      });
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    toggleDarkMode: () => {
      set((s) => {
        const next = !s.darkMode;
        localStorage.setItem('aero-avatar-darkmode', String(next));
        return { darkMode: next };
      });
    },

    setSelectedCategory: (cat) => set({ selectedCategory: cat }),

    exportJSON: () => JSON.stringify(get().avatar, null, 2),

    importJSON: (json) => {
      try {
        const parsed = JSON.parse(json) as AvatarState;
        if (parsed && typeof parsed.name === 'string') {
          set((s) => {
            const h = pushHistory(parsed, s.history, s.historyIndex);
            return { avatar: parsed, ...h };
          });
          get().saveToStorage();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },

    saveToStorage: () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(get().avatar));
      } catch {}
    },

    loadFromStorage: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AvatarState;
          if (parsed && typeof parsed.name === 'string') {
            set({ avatar: parsed, history: [{ state: parsed, timestamp: Date.now() }], historyIndex: 0 });
            return true;
          }
        }
      } catch {}
      return false;
    },
  };
});
