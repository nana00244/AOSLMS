import {
  createContext,
  useContext,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from 'react';
import type { SchoolWebsitePage, WebsiteMediaLayout } from '../data';
import { isWebsiteVideo } from '../schoolWebsiteAssets';
import './website-media.css';

type Target = { blockId?: string; itemId?: string; elementId?: string };
type Update = (target: Target, layout?: WebsiteMediaLayout) => void;
export const MediaEditContext = createContext<Update | undefined>(undefined);

export function resizePageMedia(
  page: SchoolWebsitePage,
  target: Target,
  mediaLayout?: WebsiteMediaLayout,
): SchoolWebsitePage {
  if (!target.blockId) return { ...page, mediaLayout };
  return {
    ...page,
    blocks: page.blocks.map((block) => {
      if (block.id !== target.blockId) return block;
      if (target.itemId)
        return {
          ...block,
          items: block.items.map((item) =>
            item.id === target.itemId ? { ...item, mediaLayout } : item,
          ),
        };
      if (target.elementId)
        return {
          ...block,
          elements: block.elements?.map((el) =>
            el.id === target.elementId ? { ...el, mediaLayout } : el,
          ),
        };
      return { ...block, mediaLayout };
    }),
  };
}

type Edge = 'left' | 'right' | 'top' | 'bottom' | 'corner';
const edges: Edge[] = ['left', 'right', 'top', 'bottom', 'corner'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
interface Geometry {
  left: number;
  width: number;
  height: number;
  slot: number;
}
function transform(
  g: Geometry,
  edge: Edge,
  dx: number,
  dy: number,
  fit: WebsiteMediaLayout['fit'],
  pageWidth?: boolean,
): WebsiteMediaLayout {
  const min = Math.min(32, g.slot);
  const left = edge === 'left' ? clamp(g.left + dx, 0, g.left + g.width - min) : g.left;
  const width =
    edge === 'left'
      ? g.left + g.width - left
      : edge === 'right' || edge === 'corner'
        ? clamp(g.width + dx, min, g.slot - left)
        : g.width;
  const height =
    edge === 'top'
      ? g.height - dy
      : edge === 'bottom' || edge === 'corner'
        ? g.height + dy
        : g.height;
  return {
    width: clamp((100 * width) / g.slot, 1, 100),
    left: clamp((100 * left) / g.slot, 0, 99),
    aspect: clamp(width / clamp(height, 24, 2000), 0.05, 30),
    fit,
    pageWidth,
  };
}

export function WebsiteMedia({
  src,
  alt = '',
  layout,
  target,
  variant = 'element',
  onPlayingChange,
}: {
  src: string;
  alt?: string;
  layout?: WebsiteMediaLayout;
  target: Target;
  variant?: 'hero' | 'story' | 'card' | 'gallery' | 'element' | 'slide';
  onPlayingChange?: (playing: boolean) => void;
}) {
  const update = useContext(MediaEditContext);
  const box = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ g: Geometry; x: number; y: number; edge: Edge; id: number } | null>(
    null,
  );
  const [temporary, setTemporary] = useState<WebsiteMediaLayout>();
  const active = temporary || layout;
  const fit = active?.fit || 'cover';
  const canSpanPage = ['element', 'hero', 'story', 'slide'].includes(variant);
  function measure(): Geometry {
    const b = box.current!.getBoundingClientRect(),
      s = slot.current!.getBoundingClientRect();
    return {
      left: clamp(b.left - s.left, 0, s.width - 1),
      width: b.width,
      height: b.height,
      slot: s.width,
    };
  }
  function start(e: PointerEvent<HTMLButtonElement>, edge: Edge) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { g: measure(), x: e.clientX, y: e.clientY, edge, id: e.pointerId };
  }
  function move(e: PointerEvent<HTMLButtonElement>, end = false) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const next = transform(g.g, g.edge, e.clientX - g.x, e.clientY - g.y, fit, active?.pageWidth);
    if (end) {
      gesture.current = null;
      setTemporary(undefined);
      if (e.clientX !== g.x || e.clientY !== g.y) update?.(target, next);
    } else setTemporary(next);
  }
  function key(e: KeyboardEvent<HTMLButtonElement>, edge: Edge) {
    const step = e.shiftKey ? 20 : 5;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    e.preventDefault();
    e.stopPropagation();
    update?.(target, transform(measure(), edge, dx, dy, fit, active?.pageWidth));
  }
  function current(): WebsiteMediaLayout {
    return active || transform(measure(), 'right', 0, 0, fit);
  }
  return (
    <div
      ref={slot}
      className={
        'website-media-slot media-' +
        variant +
        (active?.pageWidth && canSpanPage ? ' website-media-bleed' : '')
      }
    >
      <div
        ref={box}
        className="website-media-box"
        data-sized={active ? true : undefined}
        style={
          active
            ? {
                width: active.width + '%',
                marginLeft: active.left + '%',
                aspectRatio: active.aspect,
              }
            : undefined
        }
      >
        {isWebsiteVideo(src) ? (
          <video
            controls
            playsInline
            preload="metadata"
            src={src}
            aria-label={alt || 'School video'}
            style={{ objectFit: fit }}
            onPlay={() => onPlayingChange?.(true)}
            onPause={() => onPlayingChange?.(false)}
            onEnded={() => onPlayingChange?.(false)}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            draggable={false}
            loading={variant === 'hero' ? 'eager' : 'lazy'}
            style={{ objectFit: fit }}
          />
        )}
        {update && (
          <div
            className="website-media-tools"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
          >
            {edges.map((edge) => (
              <button
                key={edge}
                type="button"
                className={'media-grip grip-' + edge}
                aria-label={'Resize media ' + edge}
                onPointerDown={(e) => start(e, edge)}
                onPointerMove={(e) => move(e)}
                onPointerUp={(e) => move(e, true)}
                onPointerCancel={() => {
                  gesture.current = null;
                  setTemporary(undefined);
                }}
                onKeyDown={(e) => key(e, edge)}
              />
            ))}
            <div className="media-fit-tools">
              <button
                type="button"
                onClick={() =>
                  update(target, { ...current(), fit: fit === 'cover' ? 'contain' : 'cover' })
                }
              >
                {fit === 'cover' ? 'Fit entire image' : 'Fill frame'}
              </button>
              {canSpanPage && (
                <button
                  type="button"
                  onClick={() =>
                    update(target, {
                      ...current(),
                      width: 100,
                      left: 0,
                      pageWidth: !active?.pageWidth,
                    })
                  }
                >
                  {active?.pageWidth ? 'Column width' : 'Page width'}
                </button>
              )}
              {layout && (
                <button type="button" onClick={() => update(target, undefined)}>
                  Reset size
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
