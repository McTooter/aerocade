import { useMemo } from 'react';
import { useAvatarStore } from '../store/avatarStore';

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export function AmbientBackground() {
  const darkMode = useAvatarStore((s) => s.darkMode);

  const bubbles = useMemo(() => {
    const arr: Bubble[] = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 60 + Math.random() * 200,
        duration: 15 + Math.random() * 20,
        delay: Math.random() * 10,
      });
    }
    return arr;
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="bg-bubble"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            background: darkMode
              ? `radial-gradient(circle, rgba(100,181,246,0.15) 0%, transparent 70%)`
              : `radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(77,166,255,0.1) 70%)`,
            animation: `float ${b.duration}s ease-in-out ${b.delay}s infinite`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: darkMode
            ? 'radial-gradient(ellipse at 30% 20%, rgba(30,60,100,0.15) 0%, transparent 60%)'
            : 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: darkMode
            ? 'radial-gradient(ellipse at 70% 80%, rgba(20,40,80,0.2) 0%, transparent 50%)'
            : 'radial-gradient(ellipse at 70% 80%, rgba(179,224,255,0.2) 0%, transparent 50%)',
        }}
      />
    </div>
  );
}
