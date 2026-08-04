import React, { useEffect, useState } from 'react';

export type MascotMood = 'idle' | 'waving' | 'thinking';

type SpaceMove = 'drift' | 'bat';

const APHELION = {
  ink: '#454e73',
  face: '#2d3348',
  suit: '#f5efdf',
  suitShade: '#e6dcc4',
  glass: 'rgba(125, 205, 235, 0.22)',
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

/** Cycle through Aphelion's gentle drift and front-paw comet batting while active. */
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
        {/* Compact continuous cat-ear dome with translucent glass and ink rim. */}
        <path
          d="M 5.5 10 C 5.8 6.1 7.1 3.4 7.4 2.2 Q 7.7 0.7 8.9 1.7 L 12.9 5.1 L 17.1 1.7 Q 18.3 0.7 18.6 2.2 C 18.9 3.4 20.2 6.1 20.5 10 L 20.5 17.4 C 20.5 21.2 17.2 23.2 13 23.2 C 8.8 23.2 5.5 21.2 5.5 17.4 Z"
          fill={C.glass}
          stroke={C.ink}
          strokeWidth={1.15}
          strokeLinejoin="round"
        />
        {/* Ginger inner ears keep the helmet silhouette recognizably feline. */}
        <path d="M 7.5 6.2 L 7.8 2.9 L 10.7 5.2 Z M 15.3 5.2 L 18.2 2.9 L 18.5 6.2 Z" fill={C.ginger} stroke={C.ink} strokeWidth={0.55} strokeLinejoin="round" />
        {/* Cream face, eyes, smile, blush, and whisker glint inside the glass. */}
        <ellipse cx={13} cy={14.4} rx={6.2} ry={6.6} fill={C.suit} stroke={C.ink} strokeWidth={0.45} />
        <circle cx={10.7} cy={13.9} r={1.05} fill={C.face} />
        <circle cx={15.3} cy={13.9} r={1.05} fill={C.face} />
        <path d="M 11.8 16.2 q 1.2 1.1 2.4 0" stroke={C.face} strokeWidth={0.9} strokeLinecap="round" />
        <circle cx={9.2} cy={16.1} r={0.7} fill={C.blush} opacity={0.7} />
        <circle cx={16.8} cy={16.1} r={0.7} fill={C.blush} opacity={0.7} />
        <path d="M 7.4 10 Q 9.1 6.8 12 6.2" stroke={C.glint} strokeWidth={1.25} strokeLinecap="round" opacity={0.95} />
      </>
    );
  }
  return (
    <>
      {/* Full-size continuous cat-ear dome: glass first, then outlined inner ears. */}
      <path
        d="M 17 23 C 17.2 18.1 18.2 14.1 19.2 10.7 L 18.9 6.6 Q 19.2 4.7 20.9 6.1 L 31.8 14.2 L 42.2 6.1 Q 43.9 4.7 44.2 6.6 L 43.9 10.7 C 45 14.1 46 18.1 46.2 23 L 46.2 35.1 C 46.2 42.2 40.8 46.7 31.6 46.7 C 22.4 46.7 17 42.2 17 35.1 Z"
        fill={C.glass}
        stroke={C.ink}
        strokeWidth={1.65}
        strokeLinejoin="round"
      />
      {/* Ginger inner ears are part of the dome, not separate ear pods. */}
      <path d="M 20.5 16.7 L 20.5 8.8 L 28.1 14.3 Z M 35.1 14.3 L 42.7 8.8 L 42.7 16.7 Z" fill={C.ginger} stroke={C.ink} strokeWidth={0.8} strokeLinejoin="round" />
      {/* Cream face and hand-drawn features remain visible through the glass. */}
      <ellipse cx={31.6} cy={30.2} rx={11.1} ry={11.7} fill={C.suit} stroke={C.ink} strokeWidth={0.6} />
      <circle cx={26.4} cy={29.2} r={1.85} fill={C.face} />
      <circle cx={36.8} cy={29.2} r={1.85} fill={C.face} />
      <path d="M 29.3 33.7 q 1.15 1.35 2.3 0 q 1.15 1.35 2.3 0" stroke={C.face} strokeWidth={1.15} strokeLinecap="round" />
      <circle cx={23.8} cy={33.8} r={1.3} fill={C.blush} opacity={0.65} />
      <circle cx={39.4} cy={33.8} r={1.3} fill={C.blush} opacity={0.65} />
      <path d="M 19.3 31.1 q 2.2 0.6 3.8 0.4 M 19.5 34.2 q 2.1 -0.2 3.6 -0.7 M 43.9 31.1 q -2.2 0.6 -3.8 0.4 M 43.7 34.2 q -2.1 -0.2 -3.6 -0.7" stroke={C.face} strokeWidth={0.95} strokeLinecap="round" opacity={0.48} />
      <path d="M 20.2 20.5 Q 23.6 15 29.3 14" stroke={C.glint} strokeWidth={1.75} strokeLinecap="round" opacity={0.95} />
      <path d="M 19 24.5 q 0.9 -2 2.2 -3.3" stroke={C.glint} strokeWidth={1.35} strokeLinecap="round" opacity={0.7} />
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

/**
 * Aphelion's still helmet portrait for the rail, empty states, and login heroes.
 * It shares the continuous cat-ear dome, glass, face, whiskers, and collar
 * language with the full quadruped mascot.
 */
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
      <path d="M 23 43 Q 31 39.5 41 43" stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" />
      <CatHelmet C={C} />
      <path d="M 21 43 Q 31.5 46 42 43" stroke={C.suitShade} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

function SuitLeg({ C, d, boot }: { C: typeof APHELION; d: string; boot: { cx: number; cy: number } }) {
  return (
    <>
      <path d={d} stroke={C.ink} strokeWidth={5.8} strokeLinecap="round" fill="none" />
      <path d={d} stroke={C.suitShade} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <ellipse cx={boot.cx} cy={boot.cy} rx={4} ry={2.5} fill={C.suitShade} stroke={C.ink} strokeWidth={1.25} />
    </>
  );
}

/**
 * Aphelion, a hand-drawn astronaut cat resting on four little boots at the
 * bottom of the left nav rail. Idle greetings raise a front paw; thinking
 * cycles through a gentle drift and a front-paw bat at a passing comet.
 */
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
  const reactionAnim = reacting
    ? 'aphelion-hop'
    : hovering && !thinking
      ? 'aphelion-hover-wiggle'
      : '';
  const bodyAnim = drifting ? 'aphelion-drift' : 'aphelion-float';
  const liftedFrontPaw = mood === 'waving' || batting;

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-0 z-40 flex w-16 select-none items-end justify-center ${peek ? 'aphelion-peek' : ''}`}
    >
      <div
        className={`pointer-events-none md:pointer-events-auto md:cursor-pointer ${active ? 'aphelion-lean-right' : 'aphelion-lean'}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => setReacting(true)}
        title={thinking ? 'Aphelion is working…' : reacting ? 'Boost!' : 'Aphelion'}
        role="button"
        aria-label="Aphelion mascot"
      >
        <div
          className={reactionAnim}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) setReacting(false);
          }}
        >
          <svg
            viewBox="-8 0 104 88"
            width="78"
            height="66"
            fill="none"
          >
            <Sparkle x={5} y={20} s={2.2} color={C.star} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <Sparkle x={94} y={25} s={1.8} color={C.violet} className="aphelion-twinkle-slow" />
            <Sparkle x={8} y={68} s={1.6} color={C.glint} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <g
              className={bodyAnim}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              {/* Ginger tail rises behind the rounded haunches, clear of every boot. */}
              <path d="M 73 57 C 84 58 91 52 91 42 C 91 35 87 31 82 32" stroke={C.ink} strokeWidth={5.8} strokeLinecap="round" fill="none" />
              <path d="M 73 57 C 84 58 91 52 91 42 C 91 35 87 31 82 32" stroke={C.ginger} strokeWidth={3.6} strokeLinecap="round" fill="none" />

              {/* Far legs sit under the torso in suitShade to give the cat depth. */}
              <SuitLeg C={C} d="M 44 59 C 43 66 43 72 44 77" boot={{ cx: 44, cy: 79 }} />
              <SuitLeg C={C} d="M 68 59 C 68 66 67 72 67 77" boot={{ cx: 67, cy: 79 }} />

              {/* Chest, dipped back, and rounded haunches form the suited torso. */}
              <path d="M 32 44 C 37 41 43 42 48 40 C 56 38 68 40 75 45 C 80 49 81 58 77 64 C 73 70 65 72 54 71 C 45 72 36 69 32 64 C 29 59 28 49 32 44 Z" fill={C.suit} stroke={C.ink} strokeWidth={1.7} strokeLinejoin="round" />
              <path d="M 36 45 C 40 48 43 49 48 48 C 56 47 66 46 74 49" stroke={C.suitShade} strokeWidth={2} strokeLinecap="round" opacity={0.9} />

              {/* Near hind leg and near front leg keep the four-boot stance grounded. */}
              {!liftedFrontPaw && (
                <SuitLeg
                  C={C}
                  d="M 48 59 C 48 66 48 72 49 77"
                  boot={{ cx: 49, cy: 79 }}
                />
              )}
              <SuitLeg C={C} d="M 74 58 C 75 65 75 72 74 77" boot={{ cx: 74, cy: 79 }} />

              {liftedFrontPaw ? (
                /* The raised near front paw replaces only its planted leg. */
                <g
                  className={
                    mood === 'waving'
                      ? 'aphelion-wave'
                      : batting
                        ? 'aphelion-bat'
                        : ''
                  }
                  style={{ transformBox: 'fill-box', transformOrigin: '100% 100%' }}
                >
                  <path d="M 46 50 C 48 45 51 39 52 33" stroke={C.ink} strokeWidth={6.2} strokeLinecap="round" fill="none" />
                  <path d="M 46 50 C 48 45 51 39 52 33" stroke={C.suit} strokeWidth={4.1} strokeLinecap="round" fill="none" />
                  <circle cx={52.2} cy={30.5} r={3.8} fill={C.suit} stroke={C.ink} strokeWidth={1.45} />
                  <path d="M 49.9 29.1 q 1.1 -1.4 2.2 0 M 51.8 28.8 q 1.4 -1.2 2.3 0 M 53.5 29.2 q 1.1 -1 1.8 0" stroke={C.ink} strokeWidth={0.8} strokeLinecap="round" />
                </g>
              ) : (
                <path d="M 46 49 C 42 51 40 54 39 58" stroke={C.suitShade} strokeWidth={2} strokeLinecap="round" />
              )}

              {/* Small violet star badge sits forward on the shoulder/chest. */}
              <rect x={35.5} y={48} width={7.4} height={6.2} rx={1.7} fill="#fbf7ec" stroke={C.ink} strokeWidth={1} />
              <path d="M 39.2 49.1 L 39.8 50.5 L 41.2 51.1 L 39.8 51.7 L 39.2 53.1 L 38.6 51.7 L 37.2 51.1 L 38.6 50.5 Z" fill={C.violet} />

              {/* Ink-and-shade collar joins the helmet glass to the suit. */}
              <path d="M 27 44 Q 32 47 38 47 Q 44 47 49 44" stroke={C.ink} strokeWidth={2.2} strokeLinecap="round" fill="none" />
              <path d="M 28.5 44.6 Q 32 46 38 46 Q 44 46 47.5 44.6" stroke={C.suitShade} strokeWidth={1.2} strokeLinecap="round" fill="none" />

              {/* Continuous cat-ear helmet dome, cream face, whiskers, blush, and glints. */}
              <g transform="translate(-1 -3)">
                <CatHelmet C={C} />
              </g>
              {reacting && (
                <g className="aphelion-puff">
                  <path d="M 40 84 q 1.4 1.6 3 0 M 65 84 q 1.4 1.6 3 0 M 72 84 q 1.4 1.6 3.4 0" stroke={C.glint} strokeWidth={1.5} strokeLinecap="round" />
                </g>
              )}
            </g>

            {/* The comet approaches the raised paw from the front/top during batting. */}
            {batting && (
              <g className="aphelion-comet">
                <path d="M 62 29 q -7 2 -12 5" stroke={C.star} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="4 3" opacity={0.7} />
                <circle cx={64} cy={26} r={2.7} fill={C.star} />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
