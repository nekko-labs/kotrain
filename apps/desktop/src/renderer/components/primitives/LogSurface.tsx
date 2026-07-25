import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A windowed log viewer for streams that never stop growing (run activity,
 * agent output, terminal-ish feeds).
 *
 * Only the rows intersecting the viewport are mounted — an Electron renderer
 * stalls fast if a long run appends thousands of nodes — and the surface sticks
 * to the newest line while the user is at the bottom, releasing the moment they
 * scroll up to read history.
 */
export function LogSurface<T>({
  items,
  renderRow,
  rowHeight = 20,
  overscan = 12,
  follow = true,
  keyOf,
  className = '',
  style,
  label,
}: {
  items: readonly T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  /** Fixed row height in px; rows must not wrap for the window to line up. */
  rowHeight?: number;
  overscan?: number;
  /** Auto-scroll to the newest line while the user is parked at the bottom. */
  follow?: boolean;
  keyOf?: (item: T, index: number) => React.Key;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible name for the scroll region. */
  label?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(0);
  const [atBottom, setAtBottom] = useState(true);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < rowHeight);
  }, [rowHeight]);

  // Stick to the newest row as items arrive, unless the user scrolled away.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !follow || !atBottom) return;
    el.scrollTop = el.scrollHeight;
    setScrollTop(el.scrollTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, follow]);

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil((height || rowHeight * 12) / rowHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);
  const window = items.slice(start, end);

  return (
    <div
      ref={viewportRef}
      onScroll={onScroll}
      role="log"
      aria-label={label}
      aria-live="polite"
      className={`overflow-y-auto ${className}`}
      style={style}
    >
      <div style={{ height: total, position: 'relative' }}>
        <div style={{ position: 'absolute', top: start * rowHeight, left: 0, right: 0 }}>
          {window.map((item, i) => {
            const index = start + i;
            return (
              <div key={keyOf ? keyOf(item, index) : index} style={{ height: rowHeight }} className="flex items-center">
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
