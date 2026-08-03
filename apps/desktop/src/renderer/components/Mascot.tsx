import React, { useEffect, useState } from 'react';

export type MascotMood = 'idle' | 'waving' | 'thinking';

/** A space move in Aphelion' zero-g routine (cycled while the model thinks). */
type SpaceMove = 'drift' | 'orbit' | 'bat';

/**
 * Shared palette: a hand-drawn astronaut cat. Space first, cat second: the
 * helmet's ear pods, the whiskers, and the ginger tail (a nod to the original
 * ginger Nekko) are the only cat tells.
 */
const APHELION = {
  ink: '#454e73', // pencil ink, muted indigo so lines read on the dark chrome
  face: '#2d3348', // feature ink on the cream face
  suit: '#f5efdf',
  suitShade: '#e6dcc4',
  glass: 'rgba(125, 205, 235, 0.14)',
  glint: '#d8eefb',
  ginger: '#f0a35e', // tail + ear tips
  gingerDeep: '#d97b38',
  blush: '#f2a6a0',
  star: '#ffd66e',
  violet: '#8b7bff',
};

const MOVE_SEQUENCE: { move: SpaceMove; ms: number }[] = [
  { move: 'drift', ms: 4000 },
  { move: 'orbit', ms: 4200 },
  { move: 'bat', ms: 4800 },
];

/** Cycle drift → orbit → comet-batting while active; rest on 'drift' otherwise. */
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

/** A wobbly four-point sparkle, drawn as two crossed pencil strokes. */
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
 * A tiny inline Aphelion: just the helmet with a spark running its orbit, sized
 * to sit on a single text line next to a status label (a la Claude Code's
 * spinner). The orbiting spark is the "working" signal.
 */
export function MiniAphelion({ size = 18 }: { size?: number }) {
  const C = APHELION;
  return (
    <span className="aphelion-mini-float inline-block shrink-0 align-middle" style={{ lineHeight: 0 }}>
      <svg viewBox="0 0 26 26" width={size} height={size} fill="none">
        {/* ear pods */}
        <path d="M 8.6 6.9 Q 7.8 2.6 10.4 1.7 Q 12.5 2.8 12.3 5.4" fill={C.suit} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M 17.4 6.9 Q 18.2 2.6 15.6 1.7 Q 13.5 2.8 13.7 5.4" fill={C.suit} stroke={C.ink} strokeWidth={1.1} strokeLinejoin="round" />
        {/* helmet */}
        <circle cx={13} cy={13.6} r={9.2} fill={C.glass} stroke={C.ink} strokeWidth={1.2} />
        {/* cream face inside the glass */}
        <circle cx={13} cy={14.1} r={6.6} fill={C.suit} />
        <circle cx={10.6} cy={13.7} r={1.15} fill={C.face} />
        <circle cx={15.4} cy={13.7} r={1.15} fill={C.face} />
        <path d="M 11.8 16.2 q 1.2 1.1 2.4 0" stroke={C.face} strokeWidth={0.9} strokeLinecap="round" />
        {/* glint */}
        <path d="M 7.4 9.6 Q 9.2 6.9 12 6.2" stroke={C.glint} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
        {/* the working spark, running a lap around the helmet */}
        <g style={{ transformBox: 'view-box', transformOrigin: '13px 13.6px' }} className="aphelion-orbit">
          <circle cx={13} cy={1.8} r={1.4} fill={C.star} />
        </g>
      </svg>
    </span>
  );
}

/**
 * Aphelion' helmet portrait, still and centred, for the identity tiles: the
 * rail's brand mark, the empty states, and the login/pairing heroes. Same
 * hand-drawn vocabulary as the animated mascot, so the app has one cat rather
 * than a mascot in the corner and an emoji everywhere else.
 */
export function AphelionAvatar({ size = 28, title }: { size?: number; title?: string }) {
  const C = APHELION;
  return (
    <svg
      viewBox="0 0 26 24"
      width={size}
      height={(size * 24) / 26}
      fill="none"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* ear pods, ginger-tipped */}
      <path d="M 7.9 6.6 Q 6.9 1.8 9.9 0.9 Q 12.3 2.1 12 5.1" fill={C.suit} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 18.1 6.6 Q 19.1 1.8 16.1 0.9 Q 13.7 2.1 14 5.1" fill={C.suit} stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M 9 4.4 Q 9 2.6 9.9 2.2 Q 10.9 2.8 10.8 4.3" fill={C.ginger} opacity={0.9} />
      <path d="M 17 4.4 Q 17 2.6 16.1 2.2 Q 15.1 2.8 15.2 4.3" fill={C.ginger} opacity={0.9} />
      {/* helmet */}
      <circle cx={13} cy={13.2} r={10} fill={C.glass} stroke={C.ink} strokeWidth={1.3} />
      {/* cream face */}
      <circle cx={13} cy={13.8} r={7.3} fill={C.suit} />
      <circle cx={10.3} cy={13.2} r={1.3} fill={C.face} />
      <circle cx={15.7} cy={13.2} r={1.3} fill={C.face} />
      <path d="M 11.6 16 q 1.4 1.3 2.8 0" stroke={C.face} strokeWidth={1} strokeLinecap="round" />
      <circle cx={8.7} cy={15.6} r={1} fill={C.blush} opacity={0.55} />
      <circle cx={17.3} cy={15.6} r={1} fill={C.blush} opacity={0.55} />
      {/* whisker ticks */}
      <path d="M 5.9 13.2 q 1.5 0.4 2.6 0.3 M 6.1 15.4 q 1.4 -0.1 2.4 -0.4" stroke={C.face} strokeWidth={0.8} strokeLinecap="round" opacity={0.4} />
      <path d="M 20.1 13.2 q -1.5 0.4 -2.6 0.3 M 19.9 15.4 q -1.4 -0.1 -2.4 -0.4" stroke={C.face} strokeWidth={0.8} strokeLinecap="round" opacity={0.4} />
      {/* glint */}
      <path d="M 6.6 8.9 Q 8.6 5.9 11.7 5.2" stroke={C.glint} strokeWidth={1.3} strokeLinecap="round" opacity={0.85} />
    </svg>
  );
}

/**
 * Aphelion, a hand-drawn astronaut cat that floats at the bottom of the left nav
 * rail. It waves on idle/greeting and works in zero-g while the model is
 * thinking: a slow drift, then a lap around its own little orbit, then batting
 * at a passing comet, cycling until the turn ends.
 */
export function Mascot({ mood, enabled }: { mood: MascotMood; enabled: boolean }) {
  const [peek, setPeek] = useState(false);
  // Interaction: hovering gives a gentle wiggle, clicking a one-shot boost hop,
  // and either (like thinking) leans Aphelion to the right so it "points" that way.
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
  const orbiting = thinking && move === 'orbit';
  const batting = thinking && move === 'bat';

  // Point right whenever anything is animating; pick the reaction animation
  // (click beats hover; thinking keeps its own in-sprite moves).
  const active = thinking || hovering || reacting;
  const reactionAnim = reacting ? 'aphelion-hop' : hovering && !thinking ? 'aphelion-hover-wiggle' : '';
  const bodyAnim = drifting ? 'aphelion-drift' : 'aphelion-float';

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-0 z-40 flex w-16 select-none items-end justify-center ${peek ? 'aphelion-peek' : ''}`}
    >
      <div
        className={`pointer-events-none md:pointer-events-auto md:cursor-pointer ${active ? 'aphelion-lean-right' : 'aphelion-lean'}`}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => setReacting(true)}
        title={thinking ? 'Aphelion is in orbit…' : reacting ? 'Boost!' : 'Aphelion'}
        role="button"
        aria-label="Aphelion mascot"
      >
        <div
          className={reactionAnim}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) setReacting(false); }}
        >
          {/* viewBox extends past the body so the orbit + comet aren't clipped */}
          <svg viewBox="-6 -8 76 104" width="62" height="85" fill="none">
            {/* backdrop sparkles, twinkling while Aphelion works */}
            <Sparkle x={4} y={14} s={2.2} color={C.star} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />
            <Sparkle x={60} y={40} s={1.8} color={C.violet} className="aphelion-twinkle-slow" />
            <Sparkle x={8} y={64} s={1.6} color={C.glint} className={thinking ? 'aphelion-twinkle' : 'aphelion-twinkle-slow'} />

            <g className={bodyAnim} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              {/* ear pods on the helmet, ginger-tipped (the subtle cat) */}
              <path d="M 20.6 13.4 Q 19 5.4 23.9 3.7 Q 27.8 5.6 27.4 10.2" fill={C.suit} stroke={C.ink} strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M 43.4 13.4 Q 45 5.4 40.1 3.7 Q 36.2 5.6 36.6 10.2" fill={C.suit} stroke={C.ink} strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M 22.4 9.6 Q 22.4 6.4 23.9 5.8 Q 25.5 6.8 25.3 9.2" fill={C.ginger} opacity={0.9} />
              <path d="M 41.6 9.6 Q 41.6 6.4 40.1 5.8 Q 38.5 6.8 38.7 9.2" fill={C.ginger} opacity={0.9} />

              {/* helmet, drawn a touch off-round like a quick pencil circle */}
              <path
                d="M 32 8.6 C 41.4 8.2 48.8 15.4 48.6 24.8 C 48.4 34.4 41.2 41.6 32.2 41.7 C 22.8 41.8 15.4 34.6 15.5 25.2 C 15.6 15.8 22.6 9 32 8.6 Z"
                fill={C.glass}
                stroke={C.ink}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              {/* cream face inside the glass */}
              <circle cx={32} cy={26.2} r={11.6} fill={C.suit} />
              {/* eyes: round in rest, narrowed while concentrating */}
              {thinking ? (
                <path d="M 24.9 25.7 h 3.6 M 35.5 25.7 h 3.6" stroke={C.face} strokeWidth={2.1} strokeLinecap="round" />
              ) : (
                <>
                  <circle cx={26.6} cy={25.6} r={1.9} fill={C.face} />
                  <circle cx={37.4} cy={25.6} r={1.9} fill={C.face} />
                </>
              )}
              {/* muzzle + blush + whisker ticks */}
              <path d="M 29.7 29.9 q 1.15 1.35 2.3 0 q 1.15 1.35 2.3 0" stroke={C.face} strokeWidth={1.15} strokeLinecap="round" />
              <circle cx={23.7} cy={29.8} r={1.4} fill={C.blush} opacity={0.55} />
              <circle cx={40.3} cy={29.8} r={1.4} fill={C.blush} opacity={0.55} />
              <path d="M 18.7 27.4 q 2.2 0.6 3.9 0.4 M 19 30.6 q 2.1 -0.2 3.7 -0.7" stroke={C.face} strokeWidth={0.95} strokeLinecap="round" opacity={0.38} />
              <path d="M 45.3 27.4 q -2.2 0.6 -3.9 0.4 M 45 30.6 q -2.1 -0.2 -3.7 -0.7" stroke={C.face} strokeWidth={0.95} strokeLinecap="round" opacity={0.38} />
              {/* glass glint */}
              <path d="M 20.4 16.2 Q 23.6 10.9 29.4 9.9" stroke={C.glint} strokeWidth={1.7} strokeLinecap="round" opacity={0.85} />
              <path d="M 19.2 20.2 q 0.9 -1.9 2.2 -3.2" stroke={C.glint} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />

              {/* collar */}
              <ellipse cx={32} cy={42.8} rx={8.8} ry={2.7} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />

              {/* suit body */}
              <path
                d="M 24.2 43.8 C 22.3 47.2 21.3 52.2 21.5 57.8 C 21.7 63.2 22.9 67.6 24.6 70 L 39.6 70 C 41.3 67.4 42.4 63 42.5 57.6 C 42.6 52.2 41.7 47.2 39.8 43.8 Z"
                fill={C.suit}
                stroke={C.ink}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              {/* chest patch with the brand star */}
              <rect x={27.2} y={48.6} width={9.6} height={7.6} rx={2} fill="#fbf7ec" stroke={C.ink} strokeWidth={1.15} />
              <path d="M32 49.9 L32.75 51.6 L34.45 52.35 L32.75 53.1 L32 54.8 L31.25 53.1 L29.55 52.35 L31.25 51.6 Z" fill={C.violet} />
              {/* belt */}
              <path d="M 22.2 61.9 C 26 63 38 63 41.8 61.9" stroke={C.violet} strokeWidth={2} strokeLinecap="round" opacity={0.85} />

              {/* tail: the ginger giveaway, curling out of the suit */}
              <path d="M 41.8 66.4 C 48 68.2 52 65.4 52.7 60 C 53.2 56.6 51.2 54.2 48.7 54.5" stroke={C.ink} strokeWidth={5.2} strokeLinecap="round" fill="none" />
              <path d="M 41.8 66.4 C 48 68.2 52 65.4 52.7 60 C 53.2 56.6 51.2 54.2 48.7 54.5" stroke={C.ginger} strokeWidth={3.2} strokeLinecap="round" fill="none" />

              {/* left arm: waves on greeting, floats otherwise */}
              <g
                className={mood === 'waving' ? 'aphelion-wave' : ''}
                style={{ transformBox: 'fill-box', transformOrigin: '85% 20%' }}
              >
                <path d="M 24 48.6 C 20 50.2 16.6 53.2 15 56.8" stroke={C.ink} strokeWidth={6.6} strokeLinecap="round" fill="none" />
                <path d="M 24 48.6 C 20 50.2 16.6 53.2 15 56.8" stroke={C.suit} strokeWidth={4.4} strokeLinecap="round" fill="none" />
                <circle cx={14.4} cy={57.6} r={3.5} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />
              </g>
              {/* right arm: swipes at the comet while batting */}
              <g
                className={batting ? 'aphelion-bat' : ''}
                style={{ transformBox: 'fill-box', transformOrigin: '15% 20%' }}
              >
                <path d="M 40 48.6 C 44 50.2 47.4 53.2 49 56.8" stroke={C.ink} strokeWidth={6.6} strokeLinecap="round" fill="none" />
                <path d="M 40 48.6 C 44 50.2 47.4 53.2 49 56.8" stroke={C.suit} strokeWidth={4.4} strokeLinecap="round" fill="none" />
                <circle cx={49.6} cy={57.6} r={3.5} fill={C.suit} stroke={C.ink} strokeWidth={1.4} />
              </g>

              {/* legs + boots */}
              <path d="M 27.4 70 C 27.2 73.4 27.2 75.4 27.4 77.6 M 36.6 70 C 36.8 73.4 36.8 75.4 36.6 77.6" stroke={C.ink} strokeWidth={5.6} strokeLinecap="round" fill="none" />
              <path d="M 27.4 70 C 27.2 73.4 27.2 75.4 27.4 77.6 M 36.6 70 C 36.8 73.4 36.8 75.4 36.6 77.6" stroke={C.suit} strokeWidth={3.6} strokeLinecap="round" fill="none" />
              <ellipse cx={27.4} cy={79.4} rx={3.4} ry={2.5} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />
              <ellipse cx={36.6} cy={79.4} rx={3.4} ry={2.5} fill={C.suitShade} stroke={C.ink} strokeWidth={1.3} />

              {/* boost puff under the boots on click */}
              {reacting && (
                <g className="aphelion-puff">
                  <path d="M 26 84 q 1.4 1.6 3 0 M 33 84.6 q 1.6 1.6 3.4 0" stroke={C.glint} strokeWidth={1.6} strokeLinecap="round" />
                  <circle cx={31} cy={87} r={1.2} fill={C.glint} />
                </g>
              )}
            </g>

            {/* orbit move: a spark laps Aphelion on a tilted ring */}
            {orbiting && (
              <g transform="rotate(-14 32 48)">
                <g transform="translate(32 48) scale(1 0.34)">
                  <circle cx={0} cy={0} r={30} stroke={C.glint} strokeWidth={1.6} strokeDasharray="3 5" opacity={0.4} fill="none" />
                  <g className="aphelion-orbit">
                    <circle cx={30} cy={0} r={3.1} fill={C.star} />
                  </g>
                </g>
              </g>
            )}

            {/* bat move: a comet drifts through and gets swatted */}
            {batting && (
              <g className="aphelion-comet">
                <path d="M 0 0 q -7 1.4 -13 3.6" stroke={C.star} strokeWidth={1.3} strokeLinecap="round" strokeDasharray="4 3" opacity={0.7} />
                <circle cx={1.5} cy={-0.5} r={2.5} fill={C.star} />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
