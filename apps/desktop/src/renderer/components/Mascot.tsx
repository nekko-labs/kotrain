import React, { useEffect, useState } from 'react';

export type MascotMood = 'idle' | 'waving' | 'thinking';

type SpaceMove = 'drift' | 'bat';

const APHELION = {
  ink: '#454e73',
  face: '#2d3348',
  suit: '#f5efdf',
  suitShade: '#e6dcc4',
  glass: 'rgba(125, 205, 235, 0.14)',
  glint: '#d8eefb',
  ginger: '#f0a35e',
  blush: '#f2a6a0',
  star: '#ffd66e',
  violet: '#8b7bff',
};

const MOVE_SEQUENCE: { move: SpaceMove; ms: number }[] = [
  { move: 'drift', ms: 4000 },
  { move: 'bat', ms: 4800 },
];

function useSpaceMove(active: boolean): SpaceMove {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setI((n) => (n + 1) % MOVE_SEQUENCE.length), MOVE_SEQUENCE[i].ms);
    return () => clearTimeout(t);
  }, [active, i]);
  useEffect(() => {
    if (!active) setI(0);
  }, [active]);
  return MOVE_SEQUENCE[i].move;
}

function Sparkle({ x, y, s, color, className }: { x: number; y: number; s: number; color: string; className?: string }) {
  return (
    <g className={className} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      <path
        d={`M ${x - s} ${y} Q ${x} ${y - 0.4} ${x + s} ${y} M ${x} ${y - s} Q ${x + 0.3} ${y} ${x} ${y + s}`}
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

function CatHelmet({ C, compact = false }: { C: typeof APHELION; compact?: boolean }) {
  if (compact) {
    return (
      <>
        <path d="M 5.5 9.1 C 5.7 5.3 7.1 3.1 7.2 2.2 Q 7.5 0.7 8.6 1.6 L 12.9 5.1 L 17.4 1.6 Q 18.5 0.7 18.8 2.2 C 18.9 3.1 20.3 5.3 20.5 9.1 L 20.5 17.5 C 20.5 21.2 17.2 23.2 13 23.2 C 8.8 23.2 5.5 21.2 5.5 17.5 Z" fill={C.glass} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M 7.2 6.2 L 7.4 2.7 L 10.4 5.1 Z M 15.6 5.1 L 18.6 2.7 L 18.8 6.2 Z" fill={C.ginger} opacity={0.9} />
        <circle cx={13} cy={14.3} r={6.4} fill={C.suit} />
        <circle cx={10.7} cy={13.8} r={1.1} fill={C.face} />
        <circle cx={15.3} cy={13.8} r={1.1} fill={C.face} />
        <path d="M 11.8 16.2 q 1.2 1.1 2.4 0" stroke={C.face} strokeWidth={0.9} strokeLinecap="round" />
        <path d="M 7.4 9.8 Q 9.2 6.9 12 6.2" stroke={C.glint} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
      </>
    );
  }
  return (
    <>
      <path d="M 16.5 22.5 C 16.8 17 18 13 19 10 L 18.6 6.4 Q 19.2 4.7 20.8 6 L 31.8 14.2 L 42.2 6 Q 43.8 4.7 44.4 6 L 44 10 C 45.2 13 46.9 17 47.5 22.5 L 47.5 35.8 C 47.5 42.5 41.5 46.8 32 46.8 C 22.5 46.8 16.5 42.5 16.5 35.8 Z" fill={C.glass} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M 20.5 16.5 L 20.4 8.7 L 28 14.2 Z M 36 14.2 L 43.6 8.7 L 43.5 16.5 Z" fill={C.ginger} opacity={0.9} />
      <circle cx={32} cy={30} r={11.6} fill={C.suit} />
      <circle cx={26.6} cy={29.2} r={1.9} fill={C.face} />
      <circle cx={37.4} cy={29.2} r={1.9} fill={C.face} />
      <path d="M 29.7 33.6 q 1.15 1.35 2.3 0 q 1.15 1.35 2.3 0" stroke={C.face} strokeWidth={1.15} strokeLinecap="round" />
      <circle cx={23.7} cy={33.5} r={1.4} fill={C.blush} opacity={0.55} />
      <circle cx={40.3} cy={33.5} r={1.4} fill={C.blush} opacity={0.55} />
      <path d="M 18.7 31.1 q 2.2 0.6 3.9 0.4 M 19 34.3 q 2.1 -0.2 3.7 -0.7 M 45.3 31.1 q -2.2 0.6 -3.9 0.4 M 45 34.3 q -2.1 -0.2 -3.7 -0.7" stroke={C.face} strokeWidth={0.95} strokeLinecap="round" opacity={0.38} />
      <path d="M 20.4 20.2 Q 23.6 14.9 29.4 13.9" stroke={C.glint} strokeWidth={1.7} strokeLinecap="round" opacity={0.85} />
      <path d="M 19.2 24.2 q 0.9 -1.9 2.2 -3.2" stroke={C.glint} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
    </>
  );
}

export function MiniAphelion({ size = 18 }: { size?: number }) {
  const C = APHELION;
  return (
    <span className="aphelion-mini-float inline-block shrink-0 align-middle" style={{ lineHeight: 0 }}>
      <svg viewBox="0 0 26 26" width={size} height={size} fill="none">
        <CatHelmet C={C} compact />
        <g style={{ transformBox: 'view-box', transformOrigin: '13px 13.6px' }} className="aphelion-orbit">
          <circle cx={13} cy={1.8} r={1.4} fill={C.star} />
        </g>
      </svg>
    </span>
  );
}

export function AphelionAvatar({ size = 28, title }: { size?: number; title?: string }) {
  const C = APHELION;
  return (
    <svg
      viewBox="0 0 64 48"
      width={size}
      height={(size * 48) / 64}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <CatHelmet C={C} />
    </svg>
  );
}

export function Mascot({ mood, enabled }: { mood: MascotMood; enabled: boolean }) {
  const [peek, setPeek] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [reacting, setReacting] = useState(false);
  const thinking = mood === 'thinking';
  const move = useSpaceMove(thinking);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setPeek(true), 400);
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;
  const C = APHELION;
  const drifting = thinking && move === 'drift';
  const batting = thinking && move === 'bat';
  const active = thinking || hovering || reacting;
  const reactionAnim = reacting ? 'aphelion-hop' : hovering && !thinking ? 'aphelion-hover-wiggle' : '';
  const bodyAnim = drifting ? 'aphelion-drift' : 'aphelion-float';

  return (
    <div className={`pointer-events-none fixed bottom-4 left-0 z-40 flex w-16 select-none items-end justify-center ${peek ? 'aphelion-peek' : ''}`}>
      <div
        className={`pointer-events-none md:pointer-events-auto md:cursor-pointer ${active ? 'aphelion-lean-right' : 'aphelion-lean'}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => setReacting(true)}
        title={thinking ? 'Aphelion is working…' : reacting ? 'Boost!' : 'Aphelion'}
        role="button"
        aria-label="Aphelion mascot"
      >
        <div className={reactionAnim} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setReacting(false); }}>
          <svg viewBox="-8 0 104 88" width="78" height="66" fill="none">
            <Sparkle x={5} y={20} s={2.2} color={C.star} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <Sparkle x={92} y={28} s={1.8} color={C.violet} className="aphelion-twinkle-slow" />
            <Sparkle x={8} y={68} s={1.6} color={C.glint} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />

            <g className={bodyAnim} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <path d="M 68 57 C 79 61 88 55 88 46 C 88 40 84 37 80 39" stroke={C.ink} strokeWidth={5.5} strokeLinecap="round" fill="none" />
              <path d="M 68 57 C 79 61 88 55 88 46 C 88 40 84 37 80 39" stroke={C.ginger} strokeWidth={3.4} strokeLinecap="round" fill="none" />

              <path d="M 25 43 C 31 39 62 39 72 45 C 76 48 76 59 72 65 C 63 70 32 70 23 64 C 19 58 20 48 25 43 Z" fill={C.suit} stroke={C.ink} strokeWidth={1.6} strokeLinejoin="round" />
              <path d="M 28 49 C 39 51 58 51 70 49" stroke={C.suitShade} strokeWidth={2} strokeLinecap="round" />
              <rect x={42} y={48} width={9.6} height={7.6} rx={2} fill="#fbf7ec" stroke={C.ink} strokeWidth={1.15} />
              <path d="M 47 49.3 L 47.75 51 L 49.45 51.75 L 47.75 52.5 L 47 54.2 L 46.25 52.5 L 44.55 51.75 L 46.25 51 Z" fill={C.violet} />

              <path d="M 27 61 C 23 62 19 63 16 66" stroke={C.ink} strokeWidth={6.2} strokeLinecap="round" fill="none" />
              <path d="M 27 61 C 23 62 19 63 16 66" stroke={C.suit} strokeWidth={4.1} strokeLinecap="round" fill="none" />
              <circle cx={14.8} cy={66.8} r={3.6} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />
              <path d="M 70 55 C 75 54 79 55 82 58" stroke={C.ink} strokeWidth={6.2} strokeLinecap="round" fill="none" />
              <path d="M 70 55 C 75 54 79 55 82 58" stroke={C.suit} strokeWidth={4.1} strokeLinecap="round" fill="none" />
              <circle cx={83.3} cy={58.6} r={3.6} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />

              <path d="M 29 63 C 28 68 27 73 28 77 M 39 66 C 39 70 39 74 40 77 M 59 66 C 59 70 59 74 58 77 M 69 63 C 70 68 71 73 70 77" stroke={C.ink} strokeWidth={5.8} strokeLinecap="round" fill="none" />
              <path d="M 29 63 C 28 68 27 73 28 77 M 39 66 C 39 70 39 74 40 77 M 59 66 C 59 70 59 74 58 77 M 69 63 C 70 68 71 73 70 77" stroke={C.suit} strokeWidth={3.6} strokeLinecap="round" fill="none" />
              <ellipse cx={27.8} cy={79} rx={4} ry={2.6} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />
              <ellipse cx={40} cy={79} rx={4} ry={2.6} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />
              <ellipse cx={58} cy={79} rx={4} ry={2.6} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />
              <ellipse cx={70.2} cy={79} rx={4} ry={2.6} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />

              <g className={mood === 'waving' ? 'aphelion-wave' : ''} style={{ transformBox: 'fill-box', transformOrigin: '85% 20%' }}>
                <path d="M 28 48 C 22 44 17 38 17 31" stroke={C.ink} strokeWidth={6.4} strokeLinecap="round" fill="none" />
                <path d="M 28 48 C 22 44 17 38 17 31" stroke={C.suit} strokeWidth={4.2} strokeLinecap="round" fill="none" />
                <circle cx={17} cy={29.6} r={3.5} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />
              </g>
              <g className={batting ? 'aphelion-bat' : ''} style={{ transformBox: 'fill-box', transformOrigin: '15% 20%' }}>
                <path d="M 67 49 C 73 48 79 45 83 41" stroke={C.ink} strokeWidth={6.4} strokeLinecap="round" fill="none" />
                <path d="M 67 49 C 73 48 79 45 83 41" stroke={C.suit} strokeWidth={4.2} strokeLinecap="round" fill="none" />
                <circle cx={84.2} cy={39.8} r={3.5} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />
              </g>

              <g transform="translate(-1 -3)">
                <CatHelmet C={C} />
              </g>
              {reacting && (
                <g className="aphelion-puff">
                  <path d="M 25 84 q 1.4 1.6 3 0 M 37 84 q 1.6 1.6 3.4 0 M 56 84 q 1.4 1.6 3 0 M 68 84 q 1.6 1.6 3.4 0" stroke={C.glint} strokeWidth={1.5} strokeLinecap="round" />
                </g>
              )}
            </g>

            {batting && (
              <g className="aphelion-comet">
                <path d="M 100 20 q -7 1.4 -13 3.6" stroke={C.star} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="4 3" opacity={0.7} />
                <circle cx={101.5} cy={19.5} r={2.5} fill={C.star} />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
