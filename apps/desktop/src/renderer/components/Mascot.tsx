import React, { useCallback, useEffect, useRef, useState } from 'react';

export type MascotMood = 'idle' | 'waving' | 'thinking';

/** Activity poses map the app's state to one legible piece of cat behavior. */
type MascotPose = 'lying' | 'waking' | 'stretching' | 'bug' | 'sleeping';

/**
 * Hand-drawn outline palette. The ink and paper ride the app's theme tokens,
 * so the drawing works on light and dark chrome without per-theme tuning;
 * ginger stays Aphelion's one spot color (tail and inner ears).
 */
const INK = 'var(--ink)';
const PAPER = 'var(--paper)';
const GINGER = '#f0a35e';
const ACCENT = 'var(--accent)';

const AFK_MS = 60_000;
const STRETCH_MS = 12_000;
const POSE_LABELS: Record<MascotPose, string> = {
  lying: 'Aphelion is resting',
  waking: 'Aphelion is getting up',
  stretching: 'Aphelion is stretching',
  bug: 'Aphelion spotted a bug',
  sleeping: 'Aphelion is sleeping',
};

/** Coordinate agent activity, user activity, and AFK time without involving the app store. */
function useMascotPose(mood: MascotMood, enabled: boolean): [MascotPose, () => void] {
  const [pose, setPose] = useState<MascotPose>(mood === 'thinking' ? 'bug' : 'waking');
  const moodRef = useRef(mood);
  const afkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { moodRef.current = mood; }, [mood]);

  const armAfk = useCallback(() => {
    if (afkTimer.current) clearTimeout(afkTimer.current);
    if (!enabled || document.hidden) return;
    afkTimer.current = setTimeout(() => {
      if (moodRef.current !== 'thinking') setPose('sleeping');
    }, AFK_MS);
  }, [enabled]);

  const wake = useCallback(() => {
    if (!enabled || document.hidden || moodRef.current === 'thinking') return;
    setPose('waking');
    armAfk();
  }, [armAfk, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (document.hidden) setPose('sleeping');
    else if (mood === 'thinking') setPose('bug');
    else if (mood === 'waving') setPose('waking');
    else setPose((current) => current === 'bug' ? 'stretching' : current === 'sleeping' ? current : 'lying');
    if (mood !== 'thinking') armAfk();
  }, [armAfk, enabled, mood]);

  useEffect(() => {
    if (!enabled || (pose !== 'waking' && pose !== 'stretching')) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!document.hidden && moodRef.current !== 'thinking') setPose('lying');
    }, pose === 'waking' ? 1500 : 1900);
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [enabled, pose]);

  useEffect(() => {
    if (!enabled) return;
    let lastPointerMove = 0;
    const signalActivity = (event?: Event) => {
      if (event?.type === 'pointermove') {
        const now = Date.now();
        if (now - lastPointerMove < 1000) return;
        lastPointerMove = now;
      }
      setPose((current) => current === 'sleeping' && moodRef.current !== 'thinking' ? 'waking' : current);
      armAfk();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (afkTimer.current) clearTimeout(afkTimer.current);
        setPose('sleeping');
      } else if (moodRef.current === 'thinking') {
        setPose('bug');
      } else {
        signalActivity();
      }
    };
    window.addEventListener('keydown', signalActivity);
    window.addEventListener('pointerdown', signalActivity);
    window.addEventListener('pointermove', signalActivity, { passive: true });
    window.addEventListener('touchstart', signalActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    armAfk();
    return () => {
      window.removeEventListener('keydown', signalActivity);
      window.removeEventListener('pointerdown', signalActivity);
      window.removeEventListener('pointermove', signalActivity);
      window.removeEventListener('touchstart', signalActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      if (afkTimer.current) clearTimeout(afkTimer.current);
    };
  }, [armAfk, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      if (!document.hidden && moodRef.current !== 'thinking') {
        setPose((current) => current === 'lying' ? 'stretching' : current);
      }
    }, STRETCH_MS);
    return () => clearInterval(interval);
  }, [enabled]);

  return [pose, wake];
}

/** A wobbly four-point sparkle made from two crossed pencil strokes. */
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

/**
 * The cat-ear helmet dome as a single ink outline. The paper fill isn't a
 * suit color, it occludes whatever is drawn behind the head, the way inked
 * animation handles overlaps.
 */
function OutlineHelmet({ expression = 'awake', sw = 2.2 }: { expression?: 'awake' | 'curious' | 'sleeping'; sw?: number }) {
  return (
    <>
      <path
        d="M 17 23 C 17.2 18.1 18.2 14.1 19.2 10.7 L 18.9 6.6 Q 19.2 4.7 20.9 6.1 L 31.8 14.2 L 42.2 6.1 Q 43.9 4.7 44.2 6.6 L 43.9 10.7 C 45 14.1 46 18.1 46.2 23 L 46.2 35.1 C 46.2 42.2 40.8 46.7 31.6 46.7 C 22.4 46.7 17 42.2 17 35.1 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* Ginger inner-ear strokes keep the dome recognizably feline. */}
      <path d="M 21.5 15 L 21.5 9.8 L 27 13.9 M 36.2 13.9 L 41.7 9.8 L 41.7 15" stroke={GINGER} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {expression === 'sleeping' ? (
        <>
          <path d="M 24.4 29.6 q 2 1.7 4 0 M 34.8 29.6 q 2 1.7 4 0" stroke={INK} strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <path d="M 30 34.2 q 1.6 -0.8 3.2 0" stroke={INK} strokeWidth={1.3} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx={expression === 'curious' ? 27.2 : 26.4} cy={29.2} r={1.9} fill={INK} />
          <circle cx={expression === 'curious' ? 37.6 : 36.8} cy={29.2} r={1.9} fill={INK} />
          <path d="M 29.3 33.7 q 1.15 1.35 2.3 0 q 1.15 1.35 2.3 0" stroke={INK} strokeWidth={1.5} strokeLinecap="round" fill="none" />
        </>
      )}
      <path d="M 19.3 31.1 q 2.2 0.6 3.8 0.4 M 19.5 34.2 q 2.1 -0.2 3.6 -0.7 M 43.9 31.1 q -2.2 0.6 -3.8 0.4 M 43.7 34.2 q -2.1 -0.2 -3.6 -0.7" stroke={INK} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.55} />
      <path d="M 20.2 20.5 Q 23.6 15 29.3 14" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.5} />
    </>
  );
}

function RestPose({ sleeping = false }: { sleeping?: boolean }) {
  return (
    <g className={sleeping ? 'aphelion-sleep' : 'aphelion-breathe'}>
      <path d="M 30 62 C 21 61 15 56 16 50 C 17 45 22 43 27 45" stroke={GINGER} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M 27 50 C 33 42 46 40 61 44 C 71 46 79 53 79 61 C 79 70 68 75 52 74 C 37 75 25 70 24 62 C 23 58 24 53 27 50 Z" fill={PAPER} stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Tucked front paws peek out under the chest as two little rolls. */}
      <path d="M 53.5 73.2 q 0.3 4.6 4.6 4.6 q 4.2 0 4.4 -3.6" fill={PAPER} stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
      <path d="M 62.6 74 q 0.5 3.9 4.4 3.8 q 3.7 -0.1 3.9 -3.2" fill={PAPER} stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
      <path d="M 34 55 q -4.5 6.5 0.5 12.5" stroke={INK} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.5} />
      <g transform="translate(53 21) scale(.9)">
        <OutlineHelmet expression={sleeping ? 'sleeping' : 'awake'} />
      </g>
      {sleeping && (
        <g className="aphelion-zs" fill={INK} fontFamily="Inter, system-ui, sans-serif" fontWeight="700">
          <text x="96" y="42" fontSize="9">z</text>
          <text x="104" y="30" fontSize="12">z</text>
        </g>
      )}
    </g>
  );
}

function StretchPose() {
  return (
    <g className="aphelion-stretch">
      <path d="M 30 57 C 22 56 17 50 19 43 C 21 36 18 32 13 32" stroke={GINGER} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M 28 48 C 31 37 42 33 52 38 C 61 42 64 53 71 61 C 65 68 51 70 39 67 C 29 65 24 58 28 48 Z" fill={PAPER} stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 70 63 C 78 70 86 75 95 77 M 96 80 q -4 2 -8 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <path d="M 65 62 C 71 71 78 77 86 79 M 87 83 q -4 2 -8 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <g transform="translate(57 34) scale(.78)">
        <OutlineHelmet expression="sleeping" sw={2.6} />
      </g>
    </g>
  );
}

function BugPose() {
  return (
    <g className="aphelion-bug-watch">
      <path d="M 44 71 C 33 73 24 68 25 59 C 26 52 22 50 18 52" stroke={GINGER} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M 44 43 C 51 38 64 39 73 45 C 79 51 79 65 73 72 C 65 78 50 77 43 70 C 38 62 38 49 44 43 Z" fill={PAPER} stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 46 68 Q 51 73 52 84 M 54 87 q -4.5 2 -9 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <path d="M 66 68 Q 71 73 72 84 M 74 87 q -4.5 2 -9 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Both front paws brace toward the bug. */}
      <path d="M 69 47 Q 85 44 100 33 M 72 55 Q 88 57 101 48" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
      <g transform="translate(56 4) scale(.84)">
        <OutlineHelmet expression="curious" sw={2.4} />
      </g>
      <g className="aphelion-bug">
        <circle cx={106} cy={24} r={2.4} fill={INK} />
        <path d="M 103 21 L 100 18 M 108 21 L 111 18 M 103 26 L 100 29 M 108 26 L 111 29" stroke={INK} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        <path d="M 103 23 Q 98 21 97 17 M 108 23 Q 112 20 113 17" stroke={GINGER} strokeWidth={1.2} strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

function StandPose() {
  return (
    <g transform="translate(108 0) scale(-1 1)">
      <g className="aphelion-stand" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <path d="M 73 57 C 84 58 91 52 91 42 C 91 35 87 31 82 32" stroke={GINGER} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        {/* Far legs first so the paper-filled torso occludes their tops. */}
        <path d="M 44 60 C 43 66 43 72 44 78 M 47 80 q -3.5 1.6 -7 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        <path d="M 68 60 C 68 66 67 72 67 78 M 70 80 q -3.5 1.6 -7 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        <path d="M 32 44 C 37 41 43 42 48 40 C 56 38 68 40 75 45 C 80 49 81 58 77 64 C 73 70 65 72 54 71 C 45 72 36 69 32 64 C 29 59 28 49 32 44 Z" fill={PAPER} stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 48 60 C 48 66 48 72 49 78 M 52 80 q -3.5 1.6 -7 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        <path d="M 74 59 C 75 65 75 72 74 78 M 77 80 q -3.5 1.6 -7 0" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        {/* Collar line joins the helmet to the body. */}
        <path d="M 27 44 Q 32 47 38 47 Q 44 47 49 44" stroke={INK} strokeWidth={1.8} strokeLinecap="round" fill="none" />
        <g transform="translate(-1 -3)">
          <OutlineHelmet />
        </g>
      </g>
    </g>
  );
}

export function MiniAphelion({ size = 18 }: { size?: number }) {
  return (
    <span className="aphelion-mini-float inline-block shrink-0 align-middle" style={{ lineHeight: 0 }}>
      <svg viewBox="0 0 26 26" width={size} height={size} fill="none">
        {/* Compact outline dome; a heavier stroke keeps it legible at 18px. */}
        <path
          d="M 5.5 10 C 5.8 6.1 7.1 3.4 7.4 2.2 Q 7.7 0.7 8.9 1.7 L 12.9 5.1 L 17.1 1.7 Q 18.3 0.7 18.6 2.2 C 18.9 3.4 20.2 6.1 20.5 10 L 20.5 17.4 C 20.5 21.2 17.2 23.2 13 23.2 C 8.8 23.2 5.5 21.2 5.5 17.4 Z"
          fill={PAPER}
          stroke={INK}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <path d="M 7.9 6 L 8 3.1 L 10.5 5.2 M 15.5 5.2 L 18 3.1 L 18.1 6" stroke={GINGER} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx={10.7} cy={13.9} r={1.1} fill={INK} />
        <circle cx={15.3} cy={13.9} r={1.1} fill={INK} />
        <path d="M 11.8 16.2 q 1.2 1.1 2.4 0" stroke={INK} strokeWidth={1} strokeLinecap="round" fill="none" />
        <g style={{ transformBox: 'view-box', transformOrigin: '13px 13.6px' }} className="aphelion-orbit">
          <circle cx={13} cy={1.8} r={1.4} fill={GINGER} />
        </g>
      </svg>
    </span>
  );
}

/**
 * Aphelion's still helmet portrait for the rail, empty states, and login heroes.
 * Same outline dome, ginger inner ears, and face language as the full mascot.
 */
export function AphelionAvatar({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      viewBox="16.1 3.5 31 44.5"
      width={size}
      height={(size * 44.5) / 31}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M 23 43 Q 31 39.5 41 43" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <OutlineHelmet />
      <path d="M 21 43.5 Q 31.5 46.5 42 43.5" stroke={INK} strokeWidth={1.4} strokeLinecap="round" fill="none" opacity={0.45} />
    </svg>
  );
}

/**
 * Aphelion, a hand-drawn outline cat living at the bottom of the left rail.
 * One ink stroke on the theme's paper, with a turbulence "line boil" that
 * re-seeds a few times a second so the drawing reads as 2D hand-drawn
 * animation. User and agent activity select a right-facing wake, rest,
 * stretch, bug-watch, or sleep pose.
 */
export function Mascot({ mood, enabled }: { mood: MascotMood; enabled: boolean }) {
  const [peek, setPeek] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [pose, wake] = useMascotPose(mood, enabled);
  const thinking = mood === 'thinking';
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setPeek(true), 400);
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-2 left-0 z-40 flex w-16 select-none items-end justify-center ${peek ? 'aphelion-peek' : ''}`}
    >
      <div
        className={`pointer-events-none md:pointer-events-auto md:cursor-pointer ${hovering ? 'aphelion-attentive' : ''} ${typeof document !== 'undefined' && document.hidden ? 'aphelion-paused' : ''}`}
        data-mascot-pose={pose}
        onMouseEnter={() => { setHovering(true); wake(); }}
        onMouseLeave={() => setHovering(false)}
        onClick={wake}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wake(); } }}
        title={POSE_LABELS[pose]}
        role="button"
        tabIndex={0}
        aria-label={POSE_LABELS[pose]}
      >
        <div className={pose === 'waking' ? 'aphelion-wake' : ''}>
          <svg
            viewBox="0 0 114 92"
            width="108"
            height="87"
            fill="none"
          >
            <defs>
              {/* The line boil: fractal noise displaces every stroke a hair,
                  re-seeding a few times a second, the wobble of traditional
                  frame-by-frame ink. CSS gates it (reduced motion, hidden). */}
              <filter id="aphelion-boil" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="1" result="n">
                  <animate attributeName="seed" values="1;7;13;4;9" dur="0.55s" repeatCount="indefinite" calcMode="discrete" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <Sparkle x={7} y={18} s={2.2} color={GINGER} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <Sparkle x={109} y={41} s={1.8} color={ACCENT} className="aphelion-twinkle-slow" />
            <Sparkle x={10} y={78} s={1.6} color={GINGER} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <g className="aphelion-boil">
              {pose === 'lying' && <RestPose />}
              {pose === 'sleeping' && <RestPose sleeping />}
              {pose === 'stretching' && <StretchPose />}
              {pose === 'bug' && <BugPose />}
              {pose === 'waking' && <StandPose />}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
