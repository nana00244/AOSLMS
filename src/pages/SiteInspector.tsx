import { useState, type ChangeEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { SchoolWebsiteBlock, SchoolWebsiteContent, SchoolWebsitePage } from '../data';
import { uploadSchoolWebsiteImage } from '../schoolWebsiteAssets';
import { createSiteItem, sectionTemplates } from './siteTemplates';

type Item = SchoolWebsiteBlock['items'][number];
type Typography = NonNullable<SchoolWebsitePage['textStyles']>[string];
type Edit<T> = (change: (current: T) => T) => void;
type UploadPending = (delta: 1 | -1) => void;

const fonts = ['DM Sans', 'Manrope', 'Arial', 'Georgia', 'Verdana'];

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="site-edit-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="site-edit-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StyledField<T extends { textStyles?: Record<string, Typography> }>({
  label,
  field,
  target,
  edit,
  multiline,
  size = 16,
}: {
  label: string;
  field: keyof T & string;
  target: T;
  edit: Edit<T>;
  multiline?: boolean;
  size?: number;
}) {
  const stored = target.textStyles?.[field];
  const style = stored ?? { fontFamily: 'DM Sans', fontSize: size, color: '#344760' };
  const setStyle = (patch: Partial<Typography>) =>
    edit((current) => ({
      ...current,
      textStyles: {
        ...current.textStyles,
        [field]: { ...style, ...current.textStyles?.[field], ...patch },
      },
    }));
  function reset() {
    edit((current) => {
      const textStyles = { ...current.textStyles };
      delete textStyles[field];
      return { ...current, textStyles };
    });
  }
  return (
    <div className="studio-styled-field">
      <Field
        label={label}
        value={String(target[field] ?? '')}
        multiline={multiline}
        onChange={(value) => edit((current) => ({ ...current, [field]: value }))}
      />
      <details className="studio-type-tools">
        <summary>{label} typography</summary>
        <div className="field-typography">
          <label>
            Font
            <select
              aria-label={label + ' font'}
              value={style.fontFamily}
              onChange={(event) => setStyle({ fontFamily: event.target.value })}
            >
              {fonts.map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </label>
          <label>
            Size · {style.fontSize}px
            <input
              aria-label={label + ' font size'}
              type="range"
              min="10"
              max="100"
              value={style.fontSize}
              onChange={(event) => setStyle({ fontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            Colour
            <input
              aria-label={label + ' colour'}
              type="color"
              value={style.color}
              onChange={(event) => setStyle({ color: event.target.value })}
            />
          </label>
        </div>
        {stored && (
          <button className="builder-ghost" type="button" onClick={reset}>
            Use default typography
          </button>
        )}
      </details>
    </div>
  );
}

function ImageField({
  label,
  value,
  apply,
  pending,
}: {
  label: string;
  value: string;
  apply: (url: string) => void;
  pending?: UploadPending;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    pending?.(1);
    try {
      apply(await uploadSchoolWebsiteImage(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed. Try again.');
    } finally {
      setUploading(false);
      pending?.(-1);
    }
  }
  return (
    <div className="studio-image-field">
      <label className="site-edit-field">
        <span>{label}</span>
        <input type="file" accept="image/*" disabled={uploading} onChange={upload} />
      </label>
      {uploading && <small role="status">Uploading image…</small>}
      {error && <small role="alert">{error}</small>}
      {value && (
        <div>
          <img className="editor-preview" src={value} alt={label + ' preview'} />
          <button
            type="button"
            className="builder-ghost"
            onClick={() => apply('')}
            disabled={uploading}
          >
            Remove image
          </button>
        </div>
      )}
    </div>
  );
}

function move<T>(list: T[], index: number, to: number) {
  if (index < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(index, 1));
  return next;
}

function ListActions({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        className="site-icon-btn"
        aria-label={'Move ' + label + ' up'}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </button>
      <button
        type="button"
        className="site-icon-btn"
        aria-label={'Move ' + label + ' down'}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </button>
      <button
        type="button"
        className="site-icon-btn danger"
        aria-label={'Remove ' + label}
        onClick={onRemove}
      >
        <Trash2 />
      </button>
    </div>
  );
}

function SiteSettings({
  site,
  edit,
  pending,
}: {
  site: SchoolWebsiteContent;
  edit: Edit<SchoolWebsiteContent>;
  pending?: UploadPending;
}) {
  const fields = [
    ['brandName', 'School name'],
    ['brandSubtitle', 'School name, second line'],
    ['topLineLeft', 'Top bar, left'],
    ['topLineRight', 'Top bar, right'],
    ['footerNote', 'Footer location / information'],
    ['lmsLabel', 'LMS link label'],
  ] as const;
  return (
    <>
      <h3>Site design</h3>
      <label className="site-edit-field">
        <span>Accent colour</span>
        <input
          type="color"
          value={site.theme?.accent || '#244b8b'}
          onChange={(event) => {
            const accent = event.target.value;
            edit((current) => ({ ...current, theme: { ...current.theme, accent } }));
          }}
        />
      </label>
      <Select
        label="Site font"
        value={site.theme?.fontFamily || ''}
        choices={[
          { value: '', label: 'School default' },
          ...fonts.map((font) => ({ value: font, label: font })),
        ]}
        onChange={(fontFamily) =>
          edit((current) => ({ ...current, theme: { ...current.theme, fontFamily } }))
        }
      />
      {site.theme?.accent && (
        <button
          className="builder-ghost"
          type="button"
          onClick={() =>
            edit((current) => ({ ...current, theme: { ...current.theme, accent: undefined } }))
          }
        >
          Use default accent
        </button>
      )}
      <h3>School identity</h3>
      {fields.map(([field, label]) => (
        <Field
          key={field}
          label={label}
          value={site[field]}
          onChange={(value) => edit((current) => ({ ...current, [field]: value }))}
        />
      ))}
      <ImageField
        label="School logo"
        value={site.logo}
        pending={pending}
        apply={(logo) => edit((current) => ({ ...current, logo }))}
      />
      <h3>Navigation links</h3>
      {site.navigation.map((link, index) => {
        const patchLink = (patch: Partial<typeof link>) =>
          edit((current) => ({
            ...current,
            navigation: current.navigation.map((row, i) =>
              i === index ? { ...row, ...patch } : row,
            ),
          }));
        return (
          <div className="site-item-editor" key={index}>
            <div className="site-block-head">
              <strong>Link {index + 1}</strong>
              <ListActions
                label={'link ' + (index + 1)}
                index={index}
                count={site.navigation.length}
                onMove={(step) =>
                  edit((current) => ({
                    ...current,
                    navigation: move(current.navigation, index, index + step),
                  }))
                }
                onRemove={() =>
                  edit((current) => ({
                    ...current,
                    navigation: current.navigation.filter((_, i) => i !== index),
                  }))
                }
              />
            </div>
            <Field
              label="Link label"
              value={link.label}
              onChange={(label) => patchLink({ label })}
            />
            <Field label="Destination" value={link.path} onChange={(path) => patchLink({ path })} />
          </div>
        );
      })}
      <button
        type="button"
        className="site-add-button"
        onClick={() =>
          edit((current) => ({
            ...current,
            navigation: [...current.navigation, { label: 'New link', path: '/school' }],
          }))
        }
      >
        <Plus /> Add navigation link
      </button>
    </>
  );
}

function Items({
  block,
  edit,
  pending,
}: {
  block: SchoolWebsiteBlock;
  edit: Edit<SchoolWebsiteBlock>;
  pending?: UploadPending;
}) {
  const gallery = block.kind === 'gallery';
  const faq = block.kind === 'faq';
  const noun = gallery ? 'Photo' : faq ? 'Question' : 'Card';
  return (
    <>
      <h3>{gallery ? 'Photos' : faq ? 'Questions and answers' : 'Cards'}</h3>
      {block.items.map((entry, index) => {
        const editItem: Edit<Item> = (change) =>
          edit((current) => ({
            ...current,
            items: current.items.map((row) => (row.id === entry.id ? change(row) : row)),
          }));
        return (
          <div className="site-item-editor" key={entry.id}>
            <div className="site-block-head">
              <strong>
                {noun} {index + 1}
              </strong>
              <ListActions
                label={noun.toLowerCase() + ' ' + (index + 1)}
                index={index}
                count={block.items.length}
                onMove={(step) =>
                  edit((current) => {
                    const i = current.items.findIndex((row) => row.id === entry.id);
                    return { ...current, items: move(current.items, i, i + step) };
                  })
                }
                onRemove={() =>
                  edit((current) => ({
                    ...current,
                    items: current.items.filter((row) => row.id !== entry.id),
                  }))
                }
              />
            </div>
            {!faq && (
              <ImageField
                label={gallery ? 'Gallery photo' : 'Card image'}
                value={entry.image}
                pending={pending}
                apply={(image) => editItem((row) => ({ ...row, image }))}
              />
            )}
            {gallery ? (
              <Field
                label="Image description (alt text)"
                value={entry.title}
                onChange={(title) => editItem((row) => ({ ...row, title }))}
              />
            ) : (
              <StyledField
                label={faq ? 'Question' : 'Item title'}
                field="title"
                target={entry}
                edit={editItem}
                size={22}
              />
            )}
            <StyledField
              label={gallery ? 'Caption' : faq ? 'Answer' : 'Item text'}
              field="body"
              target={entry}
              edit={editItem}
              multiline
            />
            {block.kind === 'cards' && (
              <>
                <StyledField
                  label="Small label / detail"
                  field="detail"
                  target={entry}
                  edit={editItem}
                  size={12}
                />
                <Select
                  label="Item icon"
                  value={entry.icon}
                  choices={[
                    { value: 'graduation', label: 'Graduation' },
                    { value: 'book', label: 'Book' },
                    { value: 'heart', label: 'Heart' },
                    { value: 'science', label: 'Science' },
                    { value: 'award', label: 'Award' },
                  ]}
                  onChange={(icon) => editItem((row) => ({ ...row, icon }))}
                />
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="site-add-button"
        onClick={() => {
          const fresh = createSiteItem(gallery ? '' : 'New ' + noun.toLowerCase());
          edit((current) => ({ ...current, items: [...current.items, fresh] }));
        }}
      >
        <Plus /> Add {noun.toLowerCase()}
      </button>
    </>
  );
}

function BlockSettings({
  block,
  edit,
  pending,
}: {
  block: SchoolWebsiteBlock;
  edit: Edit<SchoolWebsiteBlock>;
  pending?: UploadPending;
}) {
  const design = block.design || {};
  const patchDesign = (patch: Partial<typeof design>) =>
    edit((current) => ({ ...current, design: { ...current.design, ...patch } }));
  return (
    <>
      <Select
        label="Section type"
        value={block.kind}
        choices={sectionTemplates.map(({ kind, label }) => ({ value: kind, label }))}
        onChange={(kind) => edit((current) => ({ ...current, kind }))}
      />
      {block.kind !== 'divider' && block.kind !== 'blank' && (
        <>
          {block.kind !== 'quote' && (
            <StyledField
              label="Section eyebrow"
              field="eyebrow"
              target={block}
              edit={edit}
              size={12}
            />
          )}
          <StyledField label="Section title" field="title" target={block} edit={edit} size={32} />
          <StyledField label="Section text" field="body" target={block} edit={edit} multiline />
          {block.kind === 'text' && (
            <ImageField
              label="Section image"
              value={block.image}
              pending={pending}
              apply={(image) => edit((current) => ({ ...current, image }))}
            />
          )}
          {block.kind === 'cta' && (
            <>
              <Field
                label="Button label"
                value={block.actionLabel}
                onChange={(actionLabel) => edit((current) => ({ ...current, actionLabel }))}
              />
              <Field
                label="Button destination"
                value={block.actionPath}
                onChange={(actionPath) => edit((current) => ({ ...current, actionPath }))}
              />
            </>
          )}
          {['cards', 'gallery', 'faq'].includes(block.kind) && (
            <Items block={block} edit={edit} pending={pending} />
          )}
        </>
      )}
      <h3>Layout and effects</h3>
      <label className="site-edit-field">
        <span>Section background</span>
        <input
          type="color"
          value={design.background || '#ffffff'}
          onChange={(event) => patchDesign({ background: event.target.value })}
        />
      </label>
      {design.background && (
        <button
          type="button"
          className="builder-ghost"
          onClick={() => patchDesign({ background: undefined })}
        >
          Use default background
        </button>
      )}
      {block.kind !== 'divider' && (
        <Select
          label="Text alignment"
          value={design.align ?? ''}
          choices={[
            { value: '', label: 'Template default' },
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centre' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(align) => patchDesign({ align: align || undefined })}
        />
      )}
      <Select
        label="Section spacing"
        value={design.spacing ?? 'normal'}
        choices={[
          { value: 'compact', label: 'Compact' },
          { value: 'normal', label: 'Normal' },
          { value: 'airy', label: 'Airy' },
        ]}
        onChange={(spacing) => patchDesign({ spacing })}
      />
      <Select
        label="Entrance effect"
        value={design.effect ?? 'none'}
        choices={[
          { value: 'none', label: 'None' },
          { value: 'fade', label: 'Fade in' },
          { value: 'rise', label: 'Rise in' },
          { value: 'zoom', label: 'Zoom in' },
        ]}
        onChange={(effect) => patchDesign({ effect })}
      />
      <label className="studio-check">
        <input
          type="checkbox"
          checked={design.hideOnMobile ?? false}
          onChange={(event) => patchDesign({ hideOnMobile: event.target.checked })}
        />{' '}
        Hide on mobile
      </label>
    </>
  );
}

export function SiteInspector({
  site,
  pageKey,
  selectedId,
  onChange,
  onUploadPending,
}: {
  site: SchoolWebsiteContent;
  pageKey: string;
  selectedId: string;
  onChange: Edit<SchoolWebsiteContent>;
  onUploadPending?: UploadPending;
}) {
  const page = site.pages[pageKey];
  if (selectedId === 'site')
    return <SiteSettings site={site} edit={onChange} pending={onUploadPending} />;
  if (!page) return null;
  const editPage: Edit<SchoolWebsitePage> = (change) =>
    onChange((current) => {
      if (!Object.hasOwn(current.pages, pageKey)) return current;
      return { ...current, pages: { ...current.pages, [pageKey]: change(current.pages[pageKey]) } };
    });
  if (selectedId === 'hero')
    return (
      <>
        <h3>Page header</h3>
        <StyledField label="Page eyebrow" field="eyebrow" target={page} edit={editPage} size={12} />
        <StyledField label="Page title" field="title" target={page} edit={editPage} size={56} />
        <StyledField
          label="Page introduction"
          field="intro"
          target={page}
          edit={editPage}
          multiline
          size={18}
        />
        <ImageField
          key={pageKey}
          label="Page hero image"
          value={page.image}
          pending={onUploadPending}
          apply={(image) => editPage((current) => ({ ...current, image }))}
        />
      </>
    );
  const block = page.blocks.find((section) => section.id === selectedId);
  if (!block) return null;
  const editBlock: Edit<SchoolWebsiteBlock> = (change) =>
    editPage((current) => ({
      ...current,
      blocks: current.blocks.map((section) =>
        section.id === selectedId ? change(section) : section,
      ),
    }));
  return (
    <BlockSettings key={selectedId} block={block} edit={editBlock} pending={onUploadPending} />
  );
}
