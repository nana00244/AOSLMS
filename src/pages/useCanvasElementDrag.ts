import { useRef, useState, type DragEvent } from 'react';
import type { SchoolWebsiteBlock } from '../data';
import type { WebsiteElementMove } from './websiteElementMove';

const mime = 'application/x-school-canvas-element';
interface DropTarget {
  sectionId: string;
  elementId?: string;
  edge: 'before' | 'after';
}
export function useCanvasElementDrag(
  blocks: SchoolWebsiteBlock[],
  onMove?: (move: WebsiteElementMove) => void,
) {
  const source = useRef<{ elementId: string; fromSectionId: string } | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const finish = () => {
    source.current = null;
    setTarget(null);
  };

  function start(event: DragEvent<HTMLElement>) {
    if (!onMove || !(event.target instanceof Element)) return;
    const el = event.target.closest<HTMLElement>('[data-canvas-element]');
    const fromSectionId = el?.closest<HTMLElement>('[data-studio-id]')?.dataset.studioId;
    const elementId = el?.dataset.canvasElement;
    if (!elementId || !fromSectionId) return;
    source.current = { elementId, fromSectionId };
    event.dataTransfer.clearData();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(mime, elementId);
    event.stopPropagation();
  }

  function readTarget(event: DragEvent<HTMLElement>): DropTarget | null {
    if (
      !onMove ||
      !source.current ||
      !(event.target instanceof Element) ||
      !event.dataTransfer.types.includes(mime)
    )
      return null;
    const sectionId = event.target.closest<HTMLElement>('.school-canvas-section[data-studio-id]')
      ?.dataset.studioId;
    if (!sectionId) return null;
    const el = event.target.closest<HTMLElement>('[data-canvas-element]');
    if (!el) return { sectionId, edge: 'after' };
    const rect = el.getBoundingClientRect();
    const sameRow = rect.width < (el.parentElement?.clientWidth ?? 0) * 0.8;
    const after = sameRow
      ? event.clientX >= rect.left + rect.width / 2
      : event.clientY >= rect.top + rect.height / 2;
    return { sectionId, elementId: el.dataset.canvasElement, edge: after ? 'after' : 'before' };
  }

  function over(event: DragEvent<HTMLElement>) {
    if (!source.current) return;
    const next = readTarget(event);
    if (next) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
    }
    if (
      target?.sectionId !== next?.sectionId ||
      target?.elementId !== next?.elementId ||
      target?.edge !== next?.edge
    )
      setTarget(next);
  }
  function drop(event: DragEvent<HTMLElement>) {
    const next = readTarget(event);
    if (!next || !source.current || !onMove) return;
    event.preventDefault();
    event.stopPropagation();
    const elements = blocks.find((block) => block.id === next.sectionId)?.elements ?? [];
    const index = elements.findIndex((el) => el.id === next.elementId);
    const beforeElementId =
      next.edge === 'before' ? next.elementId : index >= 0 ? elements[index + 1]?.id : undefined;
    const move = { ...source.current, toSectionId: next.sectionId, beforeElementId };
    finish();
    onMove(move);
  }
  function leave(event: DragEvent<HTMLElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))
      return;
    setTarget(null);
  }
  return {
    target,
    handlers: onMove
      ? {
          onDragStart: start,
          onDragEnd: finish,
          onDragOver: over,
          onDrop: drop,
          onDragLeave: leave,
        }
      : {},
  };
}
