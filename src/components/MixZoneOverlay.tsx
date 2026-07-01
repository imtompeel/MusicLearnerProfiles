import React, { useCallback, useEffect, useRef } from 'react';
import { clampMixZone, type MixZone } from '../utils/mixZone';

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

interface MixZoneOverlayProps {
  mixZone: MixZone;
  editable: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onChange: (zone: MixZone) => void;
}

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  startZone: MixZone;
  pointerId: number;
  captureTarget: HTMLElement;
}

function lockPageScroll(): void {
  document.body.classList.add('mix-zone-dragging');
}

function unlockPageScroll(): void {
  document.body.classList.remove('mix-zone-dragging');
}

export const MixZoneOverlay: React.FC<MixZoneOverlayProps> = ({
  mixZone,
  editable,
  containerRef,
  onChange
}) => {
  const dragRef = useRef<DragState | null>(null);

  const endDrag = useCallback((event?: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;

    try {
      if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
        drag.captureTarget.releasePointerCapture(drag.pointerId);
      }
    } catch {
      // pointer may already be released
    }

    dragRef.current = null;
    unlockPageScroll();

    if (event) {
      event.preventDefault();
    }
  }, []);

  const applyDrag = useCallback(
    (clientX: number, clientY: number, container: HTMLElement) => {
      const drag = dragRef.current;
      if (!drag) return;

      const rect = container.getBoundingClientRect();
      const dx = (clientX - drag.startX) / rect.width;
      const dy = (clientY - drag.startY) / rect.height;
      const start = drag.startZone;
      let next = { ...start };

      switch (drag.mode) {
        case 'move':
          next.x = start.x + dx;
          next.y = start.y + dy;
          break;
        case 'nw':
          next.x = start.x + dx;
          next.y = start.y + dy;
          next.w = start.w - dx;
          next.h = start.h - dy;
          break;
        case 'ne':
          next.y = start.y + dy;
          next.w = start.w + dx;
          next.h = start.h - dy;
          break;
        case 'sw':
          next.x = start.x + dx;
          next.w = start.w - dx;
          next.h = start.h + dy;
          break;
        case 'se':
          next.w = start.w + dx;
          next.h = start.h + dy;
          break;
        case 'n':
          next.y = start.y + dy;
          next.h = start.h - dy;
          break;
        case 's':
          next.h = start.h + dy;
          break;
        case 'w':
          next.x = start.x + dx;
          next.w = start.w - dx;
          break;
        case 'e':
          next.w = start.w + dx;
          break;
      }

      onChange(clampMixZone(next));
    },
    [onChange]
  );

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!dragRef.current) return;

      event.preventDefault();

      const container = containerRef.current;
      if (!container) return;
      applyDrag(event.clientX, event.clientY, container);
    };

    const handleEnd = (event: PointerEvent) => {
      if (!dragRef.current) return;
      endDrag(event);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleEnd, { passive: false });
    window.addEventListener('pointercancel', handleEnd, { passive: false });

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
      unlockPageScroll();
    };
  }, [applyDrag, containerRef, endDrag]);

  const startDrag = (event: React.PointerEvent, mode: DragMode) => {
    if (!editable) return;

    event.preventDefault();
    event.stopPropagation();

    const captureTarget = event.currentTarget as HTMLElement;
    captureTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startZone: { ...mixZone },
      pointerId: event.pointerId,
      captureTarget
    };

    lockPageScroll();
  };

  const isFullScreen =
    mixZone.w >= 0.99 && mixZone.h >= 0.99 && mixZone.x <= 0.01 && mixZone.y <= 0.01;

  return (
    <div className={`mix-zone-overlay ${editable ? 'editable' : 'readonly'}`}>
      {!isFullScreen && (
        <>
          <div className="mix-zone-shade mix-zone-shade-top" style={{ height: `${mixZone.y * 100}%` }} />
          <div
            className="mix-zone-shade mix-zone-shade-bottom"
            style={{ top: `${(mixZone.y + mixZone.h) * 100}%` }}
          />
          <div
            className="mix-zone-shade mix-zone-shade-left"
            style={{
              top: `${mixZone.y * 100}%`,
              height: `${mixZone.h * 100}%`,
              width: `${mixZone.x * 100}%`
            }}
          />
          <div
            className="mix-zone-shade mix-zone-shade-right"
            style={{
              top: `${mixZone.y * 100}%`,
              height: `${mixZone.h * 100}%`,
              left: `${(mixZone.x + mixZone.w) * 100}%`
            }}
          />
        </>
      )}

      <div
        className="mix-zone-rect"
        style={{
          left: `${mixZone.x * 100}%`,
          top: `${mixZone.y * 100}%`,
          width: `${mixZone.w * 100}%`,
          height: `${mixZone.h * 100}%`
        }}
        onPointerDown={(e) => startDrag(e, 'move')}
      >
        {editable && <span className="mix-zone-label">Blend zone — drag to move, corners to resize</span>}

        {editable &&
          (['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as DragMode[]).map((handle) => (
            <button
              key={handle}
              type="button"
              className={`mix-zone-handle mix-zone-handle-${handle}`}
              aria-label={`Resize blend zone ${handle}`}
              onPointerDown={(e) => startDrag(e, handle)}
            />
          ))}
      </div>
    </div>
  );
};
