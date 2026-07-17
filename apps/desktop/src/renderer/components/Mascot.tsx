import React, { useEffect, useState } from 'react';

export type MascotMood = 'idle' | 'waving' | 'thinking';

/** A training move in Nekko's kendo routine (cycled while the model thinks). */
type TrainingMove = 'punch' | 'kick' | 'bokken';

/** Shared palette: ginger cat in a kendo outfit (red hachimaki, indigo gi). */
const NEKKO = {
  body: '#f6a45c',
  dark: '#d97b38',
  cream: '#ffe2c0',
  ink: '#2a2018',
  blush: '#ff8f8f',
  band: '#e04848', // hachimaki bandana
  bandDark: '#b53535',
  gi: '#33518f', // keikogi indigo
  giDark: '#26407a', // hakama
  belt: '#e8d9b0',
  wood: '#a06a3a', // bokken
  woodDark: '#7c5028',
};

const MOVE_SEQUENCE: { move: TrainingMove; ms: number }[] = [
  { move: 'punch', ms: 2800 },
  { move: 'kick', ms: 2800 },
  { move: 'bokken', ms: 3600 },
];

/** Cycle punch → kick → bokken while active; rest on 'punch' otherwise. */
function useTrainingMove(active: boolean): TrainingMove {
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

const px = (x: number, y: number, w: number, h: number, fill: string) => (
  <rect key={`${x}-${y}-${w}-${fill}`} x={x} y={y} width={w} height={h} fill={fill} />
);

/**
 * A tiny inline Nekko in its kendo gear that throws quick alternating jabs
 * while the agent works, sized to sit on a single text line next to a status
 * label (a la Claude Code's spinner).
 */
export function MiniNekko({ size = 18 }: { size?: number }) {
  return (
    <span className="nekko-bob inline-block shrink-0 align-middle" style={{ lineHeight: 0 }}>
      <svg viewBox="0 0 32 28" width={size} height={(size * 28) / 32} shapeRendering="crispEdges">
        {/* ears */}
        {px(6, 0, 4, 4, NEKKO.body)}
        {px(18, 0, 4, 4, NEKKO.body)}
        {px(7, 1, 2, 2, NEKKO.dark)}
        {px(19, 1, 2, 2, NEKKO.dark)}
        {/* head */}
        {px(5, 3, 18, 12, NEKKO.body)}
        {px(5, 3, 18, 2, NEKKO.dark)}
        {/* hachimaki bandana + knot tail */}
        {px(5, 5, 18, 2, NEKKO.band)}
        {px(23, 5, 2, 2, NEKKO.bandDark)}
        {px(24, 7, 2, 2, NEKKO.bandDark)}
        {/* eyes */}
        {px(9, 8, 2, 3, NEKKO.ink)}
        {px(17, 8, 2, 3, NEKKO.ink)}
        {/* blush */}
        {px(7, 11, 2, 2, NEKKO.blush)}
        {px(19, 11, 2, 2, NEKKO.blush)}
        {/* muzzle */}
        {px(13, 11, 2, 2, NEKKO.cream)}
        {px(13, 11, 2, 1, NEKKO.blush)}
        {/* gi body + belt */}
        {px(8, 15, 12, 9, NEKKO.gi)}
        {px(12, 15, 4, 4, NEKKO.cream)}
        {px(8, 21, 12, 2, NEKKO.belt)}
        {/* jabbing paws */}
        <g className="nekko-jab-l" style={{ transformBox: 'fill-box' }}>{px(4, 16, 4, 5, NEKKO.body)}</g>
        <g className="nekko-jab-r" style={{ transformBox: 'fill-box' }}>{px(20, 16, 4, 5, NEKKO.body)}</g>
      </svg>
    </span>
  );
}

/**
 * Nekko, an 8-bit pixel cat in a kendo outfit (red hachimaki bandana, indigo
 * keikogi + hakama) that sits in the bottom of the left nav rail. It waves on
 * idle/greeting and trains while the model is thinking: punches, then a kick,
 * then bokken overhead swings, cycling until the turn ends.
 */
export function Mascot({ mood, enabled }: { mood: MascotMood; enabled: boolean }) {
  const [peek, setPeek] = useState(false);
  const training = mood === 'thinking';
  const move = useTrainingMove(training);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => setPeek(true), 400);
    return () => clearTimeout(t);
  }, [enabled]);

  if (!enabled) return null;
  const C = NEKKO;
  const kicking = training && move === 'kick';
  const swinging = training && move === 'bokken';
  const punching = training && move === 'punch';

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-0 z-40 flex w-16 select-none items-end justify-center ${peek ? 'nekko-peek' : ''}`}
      title={training ? 'Nekko is training…' : 'Nekko'}
    >
      {/* viewBox extends above the sprite so the raised bokken isn't clipped */}
      <svg viewBox="0 -12 36 52" width="58" height="84" shapeRendering="crispEdges">
        {/* ears */}
        {px(6, 2, 4, 4, C.body)}
        {px(18, 2, 4, 4, C.body)}
        {px(7, 3, 2, 2, C.dark)}
        {px(19, 3, 2, 2, C.dark)}
        {/* head */}
        {px(5, 5, 18, 13, C.body)}
        {px(5, 5, 18, 2, C.dark)}
        {/* hachimaki bandana across the forehead + knot tails */}
        {px(5, 7, 18, 2, C.band)}
        {px(23, 7, 2, 2, C.bandDark)}
        {px(24, 9, 2, 3, C.bandDark)}
        {px(25, 12, 2, 2, C.band)}
        {/* eyes (focused while training) */}
        {training ? (
          <>
            {px(9, 10, 2, 2, C.ink)}
            {px(17, 10, 2, 2, C.ink)}
          </>
        ) : (
          <>
            {px(9, 9, 2, 3, C.ink)}
            {px(17, 9, 2, 3, C.ink)}
          </>
        )}
        {/* blush */}
        {px(7, 12, 2, 2, C.blush)}
        {px(19, 12, 2, 2, C.blush)}
        {/* muzzle + nose */}
        {px(13, 12, 2, 2, C.cream)}
        {px(13, 12, 2, 1, C.blush)}

        {/* keikogi (gi top) + lapel V + belt, hakama below */}
        {px(7, 18, 14, 9, C.gi)}
        {px(12, 18, 2, 3, C.cream)}
        {px(14, 18, 2, 3, C.cream)}
        {px(13, 20, 2, 3, C.cream)}
        {px(7, 25, 14, 2, C.belt)}
        {px(7, 27, 14, 5, C.giDark)}

        {/* left arm: waves on greeting, jabs while punching, guards otherwise */}
        <g
          className={
            mood === 'waving' ? 'nekko-wave' : punching ? 'nekko-punch-l' : swinging ? 'nekko-arms-up' : ''
          }
          style={{ transformBox: 'fill-box' }}
        >
          {px(3, 20, 4, 6, C.gi)}
          {px(3, 24, 4, 2, C.body)}
        </g>
        {/* right arm: jabs while punching (bokken swing draws its own arms) */}
        {!swinging && (
          <g className={punching ? 'nekko-punch-r' : ''} style={{ transformBox: 'fill-box' }}>
            {px(21, 20, 4, 6, C.gi)}
            {px(21, 24, 4, 2, C.body)}
          </g>
        )}

        {/* bokken overhead swing: both paws grip the sword above the head and
            chop down in front (fast strike, slow lift, like suburi reps) */}
        {swinging && (
          <g className="nekko-swing" style={{ transformOrigin: '16px 22px' }}>
            {/* raised arms */}
            {px(12, 14, 3, 6, C.gi)}
            {px(17, 14, 3, 6, C.gi)}
            {/* paws gripping */}
            {px(13, 11, 6, 3, C.body)}
            {/* bokken blade + tip */}
            {px(15, -8, 2, 19, C.wood)}
            {px(15, -8, 2, 3, C.woodDark)}
            {/* tsuba-ish guard */}
            {px(13, 9, 6, 2, C.woodDark)}
          </g>
        )}

        {/* tail */}
        {px(21, 28, 6, 3, C.dark)}

        {/* feet / kick: right leg snaps out to the side during the kick move */}
        {px(9, 31, 4, 3, C.dark)}
        {kicking ? (
          <g className="nekko-kick" style={{ transformOrigin: '17px 32px' }}>
            {px(15, 31, 4, 3, C.dark)}
            {px(19, 31, 5, 3, C.body)}
            {px(24, 31, 3, 3, C.cream)}
          </g>
        ) : (
          px(15, 31, 4, 3, C.dark)
        )}
      </svg>
    </div>
  );
}
