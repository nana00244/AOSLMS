import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Trash2, Plus, GripVertical } from 'lucide-react';
import type { SchoolWebsiteElement, SchoolWebsiteBlock } from '../data';
import { uploadSchoolWebsiteImage } from '../schoolWebsiteAssets';
import { schoolLinkDestination } from './schoolSiteLinks';

const labels = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  button: 'Button',
  image: 'Image',
  spacer: 'Spacer',
};
type Kind = SchoolWebsiteElement['kind'];
interface CanvasElementsProps {
  elements?: SchoolWebsiteElement[];
  editable?: boolean;
  movable?: boolean;
  selectedElementId?: string;
  dropMarker?: { id: string; edge: 'before' | 'after' };
}
export function SectionElements({
  elements = [],
  editable,
  movable,
  selectedElementId,
  dropMarker,
}: CanvasElementsProps) {
  if (!elements.length) return null;
  return (
    <div className="studio-elements">
      {elements.map((element, index) => {
        let content;
        switch (element.kind) {
          case 'heading':
            content = <h3>{element.text}</h3>;
            break;
          case 'paragraph':
            content = <p>{element.text}</p>;
            break;
          case 'button': {
            const url = schoolLinkDestination(element.url);
            if (!url) {
              if (!editable) return null;
              content = <span className="school-button">{element.text || 'Button'}</span>;
              break;
            }
            content = url.startsWith('/') ? (
              <Link className="school-button" to={url}>
                {element.text}
              </Link>
            ) : (
              <a className="school-button" href={url}>
                {element.text}
              </a>
            );
            break;
          }
          case 'image':
            content = element.url && <img loading="lazy" src={element.url} alt={element.text} />;
            break;
          case 'spacer':
            content = <div className="studio-spacer" aria-hidden="true" />;
            break;
        }
        return (
          <div
            key={element.id}
            className={'studio-element width-' + element.width}
            data-canvas-element={editable ? element.id : undefined}
            data-element-selected={editable && selectedElementId === element.id ? true : undefined}
            data-element-drop={
              editable && dropMarker?.id === element.id ? dropMarker.edge : undefined
            }
            draggable={movable || undefined}
          >
            {editable && (
              <button
                type="button"
                className="studio-element-handle"
                aria-label={`Edit ${labels[element.kind].toLowerCase()} ${index + 1}`}
                title={movable ? 'Drag to move or click to edit' : 'Click to edit'}
              >
                <GripVertical size={13} />
                {labels[element.kind]}
              </button>
            )}
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function focusElementInspector(id: string) {
  const fields = document.querySelector<HTMLDetailsElement>(
    '[data-element-inspector="' + CSS.escape(id) + '"]',
  );
  if (!fields) return;
  fields.open = true;
  const input = fields.querySelector<HTMLElement>('textarea, input, select');
  input?.focus({ preventScroll: true });
  (input ?? fields).scrollIntoView({ block: 'nearest' });
}

interface ElementEditorProps {
  block: SchoolWebsiteBlock;
  edit: (fn: (block: SchoolWebsiteBlock) => SchoolWebsiteBlock) => void;
  onUploadPending: (delta: 1 | -1) => void;
}
export function ElementEditor({ block, edit, onUploadPending }: ElementEditorProps) {
  const [kind, setKind] = useState<Kind>('heading');
  const [message, setMessage] = useState('');
  const elements = block.elements || [];
  const modify = (fn: (values: SchoolWebsiteElement[]) => SchoolWebsiteElement[]) =>
    edit((current) => ({ ...current, elements: fn(current.elements || []) }));
  const patch = (id: string, values: Partial<SchoolWebsiteElement>) =>
    modify((current) =>
      current.map((element) => (element.id === id ? { ...element, ...values } : element)),
    );
  function move(id: string, direction: number) {
    modify((current) => {
      const next = [...current],
        from = next.findIndex((element) => element.id === id),
        to = from + direction;
      if (from < 0 || to < 0 || to >= next.length) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }
  async function upload(id: string, file: File) {
    onUploadPending(1);
    setMessage('Uploading image…');
    try {
      patch(id, { url: await uploadSchoolWebsiteImage(file) });
      setMessage('Image added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      onUploadPending(-1);
    }
  }
  return (
    <div className="studio-element-editor">
      <h3>Elements</h3>
      {elements.map((element, index) => (
        <details
          key={element.id}
          open
          className="studio-element-fields"
          data-element-inspector={element.id}
        >
          <summary>
            {labels[element.kind]} {index + 1}
          </summary>
          {element.kind !== 'spacer' && (
            <label>
              {element.kind === 'image'
                ? 'Image description'
                : element.kind === 'button'
                  ? 'Button text'
                  : 'Text'}
              <textarea
                value={element.text}
                onChange={(event) => patch(element.id, { text: event.target.value })}
              />
            </label>
          )}
          {element.kind === 'button' && (
            <label>
              Link destination
              <input
                value={element.url}
                onChange={(event) => patch(element.id, { url: event.target.value })}
              />
            </label>
          )}
          {element.kind === 'image' && (
            <label>
              Choose image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(element.id, file);
                }}
              />
            </label>
          )}
          <label>
            Element width
            <select
              value={element.width}
              onChange={(event) =>
                patch(element.id, { width: event.target.value as SchoolWebsiteElement['width'] })
              }
            >
              <option value="full">Full width</option>
              <option value="half">Half width</option>
              <option value="third">One third</option>
            </select>
          </label>
          <div className="studio-actions">
            <button
              type="button"
              aria-label="Move element up"
              disabled={!index}
              onClick={() => move(element.id, -1)}
            >
              <ArrowUp />
            </button>
            <button
              type="button"
              aria-label="Move element down"
              disabled={index === elements.length - 1}
              onClick={() => move(element.id, 1)}
            >
              <ArrowDown />
            </button>
            <button
              type="button"
              aria-label="Remove element"
              onClick={() => modify((current) => current.filter((e) => e.id !== element.id))}
            >
              <Trash2 />
            </button>
          </div>
        </details>
      ))}
      <label>
        Element type
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {Object.entries(labels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          const element: SchoolWebsiteElement = {
            id: crypto.randomUUID(),
            kind,
            text:
              kind === 'button'
                ? 'Get in touch'
                : kind === 'heading'
                  ? 'New heading'
                  : kind === 'paragraph'
                    ? 'Write your text here.'
                    : '',
            url: kind === 'button' ? '/school/contact' : '',
            width: 'full',
          };
          modify((current) => [...current, element]);
        }}
      >
        <Plus /> Add element
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
