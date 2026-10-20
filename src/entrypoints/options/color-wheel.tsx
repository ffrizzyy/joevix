import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../core/i18n';
import { hslToRgb } from '../../core/theme/color';

const SIZE = 200;

type Props = {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (hue: number, saturation: number) => void;
};

/**
 * Hue around the circle, saturation from center to edge. Saturation is baked
 * into the wheel at the current lightness so the picked color is what you see.
 * The wheel is an enhancement: the hex/RGB/HSL fields are the fully accessible
 * path (spec 6.6).
 */
export function ColorWheel(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useEffect(() => {
    drawWheel(canvasRef.current, props.lightness);
  }, [props.lightness]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let dragging = false;

    const pick = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const radius = rect.width / 2;
      const dx = event.clientX - (rect.left + radius);
      const dy = event.clientY - (rect.top + radius);
      const distance = Math.hypot(dx, dy);
      const saturation = Math.min(1, distance / radius);
      let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (hue < 0) hue += 360;
      onChangeRef.current(hue, saturation);
    };

    const down = (event: PointerEvent) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    };

    const move = (event: PointerEvent) => {
      if (dragging) pick(event);
    };

    const up = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, []);

  const radians = (props.hue * Math.PI) / 180;
  const left = 50 + Math.cos(radians) * props.saturation * 50;
  const top = 50 + Math.sin(radians) * props.saturation * 50;

  function onKeyDown(event: JSX.TargetedKeyboardEvent<HTMLCanvasElement>) {
    const step = event.shiftKey ? 10 : 1;
    let hue = props.hue;
    let saturation = props.saturation;

    if (event.key === 'ArrowLeft') hue -= step;
    else if (event.key === 'ArrowRight') hue += step;
    else if (event.key === 'ArrowUp') saturation += step / 100;
    else if (event.key === 'ArrowDown') saturation -= step / 100;
    else return;

    event.preventDefault();
    onChangeRef.current(((hue % 360) + 360) % 360, Math.min(1, Math.max(0, saturation)));
  }

  return (
    <div class="wheel">
      <canvas
        ref={canvasRef}
        class="wheel-canvas"
        width={SIZE}
        height={SIZE}
        tabIndex={0}
        role="img"
        aria-label={`${t('hue')} ${Math.round(props.hue)}, ${t('saturation')} ${Math.round(
          props.saturation * 100,
        )} ${t('wheelPercent')}, ${t('lightness')} ${Math.round(
          props.lightness * 100,
        )} ${t('wheelPercent')}. ${t('wheelHint')}`}
        onKeyDown={onKeyDown}
      />
      <span class="wheel-handle" aria-hidden="true" style={{ left: `${left}%`, top: `${top}%` }} />
    </div>
  );
}

function drawWheel(canvas: HTMLCanvasElement | null, lightness: number): void {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const radius = SIZE / 2;
  const image = context.createImageData(SIZE, SIZE);
  const data = image.data;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x - radius + 0.5;
      const dy = y - radius + 0.5;
      const distance = Math.hypot(dx, dy);
      const offset = (y * SIZE + x) * 4;

      if (distance > radius) {
        data[offset + 3] = 0;
        continue;
      }

      let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (hue < 0) hue += 360;

      const rgb = hslToRgb({
        h: hue,
        s: Math.min(1, distance / radius),
        l: lightness,
      });

      data[offset] = rgb.r;
      data[offset + 1] = rgb.g;
      data[offset + 2] = rgb.b;
      data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}
