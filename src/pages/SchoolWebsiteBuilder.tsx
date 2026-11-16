import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  FilePlus2,
  Globe2,
  GripVertical,
  Layers,
  Monitor,
  MousePointer2,
  Paintbrush,
  PanelsTopLeft,
  Plus,
  Redo2,
  Smartphone,
  Trash2,
  Undo2,
} from 'lucide-react';
import type {
  SchoolWebsiteBlock as Block,
  SchoolWebsiteContent as Site,
  SchoolWebsitePage as Page,
  Settings,
} from '../data';
import {
  isBuiltInSchoolPage,
  newPageKey,
  schoolPagePath,
  siteVersion,
} from '../schoolWebsiteModel';
import { migrateSchoolWebsiteImage } from '../schoolWebsiteAssets';
import { useStore } from '../store';
import { SchoolSiteCanvas } from './SchoolSiteCanvas';
import { MediaEditContext, resizePageMedia } from './WebsiteMedia';
import { ElementEditor, focusElementInspector } from './SectionElements';
import { moveWebsiteElement } from './websiteElementMove';
import { SiteInspector } from './SiteInspector';
import { createSection, sectionTemplates } from './siteTemplates';
import { useWebsiteDraft } from './useWebsiteDraft';
import './website-studio.css';

const dragType = 'application/x-school-section';
const pageLayouts: Record<string, Block['kind'][]> = {
  'Blank page': [],
  'School programme': ['text', 'cards', 'cta'],
  'Campus gallery': ['gallery', 'quote'],
  'Family information': ['text', 'faq', 'cta'],
};
async function prepareImages(site: Site) {
  const result = structuredClone(site);
  const migrate = async (value: string) =>
    value?.startsWith('data:image/') ? migrateSchoolWebsiteImage(value) : value;
  result.logo = await migrate(result.logo);
  for (const page of Object.values(result.pages)) {
    page.image = await migrate(page.image);
    for (const block of page.blocks) {
      block.image = await migrate(block.image);
      for (const item of block.items) item.image = await migrate(item.image);
      for (const el of block.elements || [])
        if (el.kind === 'image') el.url = await migrate(el.url);
    }
  }
  return result;
}
export function SchoolWebsiteBuilder({
  owner,
  published,
  source,
}: {
  owner: string;
  published: Site;
  source: Settings['publicSite'];
}) {
  const { update } = useStore();
  const version = useMemo(() => siteVersion(source), [source]);
  const { history, dispatch, problem } = useWebsiteDraft(owner, published, version);
  const site = history.current;
  const [search, setSearch] = useSearchParams();
  const pageChoice = search.get('page') || 'home';
  const pageKey = Object.hasOwn(site.pages, pageChoice) ? pageChoice : 'home';
  const page = site.pages[pageKey];
  const [selected, setSelected] = useState('hero');
  const block = page.blocks.find((b) => b.id === selected);
  const selectedId = block?.id || (selected === 'site' ? 'site' : 'hero');
  const [tab, setTab] = useState<'layers' | 'inspector' | 'library'>('layers');
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState(false);
  const [newPage, setNewPage] = useState(false);
  const [name, setName] = useState('');
  const [layout, setLayout] = useState('Blank page');
  const [elementId, setElementId] = useState<string>();
  const [uploads, setUploads] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const canvas = useRef<HTMLDivElement>(null);
  const locked = publishing || uploads > 0;
  const stale = history.dirty && history.base !== version && siteVersion(site) !== version;
  const labelFor = (key: string) =>
    site.navigation.find((n) => n.path === schoolPagePath(key))?.label ||
    site.pages[key]?.title ||
    key;
  const change = (apply: (site: Site) => Site) => {
    setNotice('');
    dispatch({ type: 'edit', apply });
  };
  const editPage = (edit: (p: Page) => Page) =>
    change((current) =>
      Object.hasOwn(current.pages, pageKey)
        ? { ...current, pages: { ...current.pages, [pageKey]: edit(current.pages[pageKey]) } }
        : current,
    );
  function choosePage(key: string) {
    canvas.current?.scrollTo({ top: 0 });
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (key === 'home') next.delete('page');
        else next.set('page', key);
        return next;
      },
      { replace: true },
    );
    setSelected('hero');
    setTab('layers');
  }
  function inspect(id: string, scroll = false) {
    setElementId(undefined);
    setSelected(id);
    setTab('inspector');
    if (scroll)
      requestAnimationFrame(() =>
        canvas.current
          ?.querySelector('[data-studio-id="' + CSS.escape(id) + '"]')
          ?.scrollIntoView({ block: 'nearest' }),
      );
  }
  function add(kind: Block['kind'], before?: string) {
    const section = createSection(kind);
    editPage((p) => {
      const blocks = [...p.blocks],
        index = blocks.findIndex((b) => b.id === before);
      blocks.splice(index < 0 ? blocks.length : index, 0, section);
      return { ...p, blocks };
    });
    inspect(section.id, true);
  }
  function move(id: string, destination: number) {
    editPage((p) => {
      const blocks = [...p.blocks],
        from = blocks.findIndex((b) => b.id === id);
      if (from < 0 || destination < 0 || destination >= blocks.length || from === destination)
        return p;
      const [section] = blocks.splice(from, 1);
      blocks.splice(destination, 0, section);
      return { ...p, blocks };
    });
  }
  function drop(event: DragEvent, target?: string) {
    const payload = event.dataTransfer.getData(dragType);
    if (!payload || locked || preview) return;
    event.preventDefault();
    event.stopPropagation();
    if (payload.startsWith('new:')) {
      const template = sectionTemplates.find((t) => t.kind === payload.slice(4));
      if (template) add(template.kind, target);
    } else if (payload.startsWith('move:')) {
      const index = page.blocks.findIndex((b) => b.id === target);
      move(payload.slice(5), index < 0 ? page.blocks.length - 1 : index);
    }
  }
  const over = (event: DragEvent) => {
    if (!locked && !preview && event.dataTransfer.types.includes(dragType)) event.preventDefault();
  };
  function duplicate() {
    if (!block) return;
    const copy = structuredClone(block);
    copy.id = crypto.randomUUID();
    copy.items.forEach((i) => {
      i.id = crypto.randomUUID();
    });
    copy.elements?.forEach((i) => {
      i.id = crypto.randomUUID();
    });
    editPage((p) => {
      const blocks = [...p.blocks];
      blocks.splice(blocks.findIndex((b) => b.id === block.id) + 1, 0, copy);
      return { ...p, blocks };
    });
    inspect(copy.id, true);
  }
  function createPage() {
    const key = newPageKey(name, site.pages);
    if (!key) {
      setNotice('Choose a different page name to create a unique web address.');
      return;
    }
    const title = name.trim();
    const blocks = pageLayouts[layout].map(createSection);
    change((s) => ({
      ...s,
      pages: { ...s.pages, [key]: { title, eyebrow: '', intro: '', image: '', blocks } },
      navigation: [...s.navigation, { label: title, path: schoolPagePath(key) }],
    }));
    choosePage(key);
    inspect('hero');
    setName('');
    setLayout('Blank page');
    setNewPage(false);
    setNotice('Page created in your draft. Publish to add it to the live website.');
  }
  function discard() {
    if (!window.confirm('Discard this browser draft and load the published website?')) return;
    dispatch({ type: 'reset', site: published, base: version });
    setNotice('Published version loaded.');
  }
  async function publish() {
    if (locked || stale) return;
    setPublishing(true);
    setNotice('Publishing…');
    try {
      const next = await prepareImages(site);
      const nextVersion = siteVersion(next);
      const ok = await update((state) => {
        const current = siteVersion(state.settings.publicSite);
        if (current !== history.base && current !== nextVersion)
          throw Error('The published site changed. Reload it before publishing.');
        return { ...state, settings: { ...state.settings, publicSite: next } };
      }, 'Published school website');
      if (ok) {
        dispatch({ type: 'reset', site: next, base: nextVersion });
        setNotice('Website published.');
      } else
        setNotice(
          'Publish was not confirmed. Your browser draft is retained. Check workspace sync before retrying.',
        );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Publishing failed. Your draft is retained.',
      );
    } finally {
      setPublishing(false);
    }
  }
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if (locked || preview || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))
        return;
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        dispatch({ type: key === 'y' || e.shiftKey ? 'redo' : 'undo' });
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [locked, preview, dispatch]);
  const index = page.blocks.findIndex((b) => b.id === selectedId);
  const uploadPending = (delta: 1 | -1) => setUploads((n) => n + delta);
  return (
    <main className="website-studio">
      <header className="studio-top">
        <div className="studio-identity">
          <Link to="/" aria-label="Back to admin workspace">
            <ArrowLeft />
          </Link>
          <span className="studio-mark">
            <PanelsTopLeft />
          </span>
          <h1>Website studio</h1>
        </div>
        <div className="studio-tools">
          <div className="studio-history">
            <button
              title="Undo"
              aria-label="Undo"
              disabled={locked || preview || !history.past.length}
              onClick={() => dispatch({ type: 'undo' })}
            >
              <Undo2 />
            </button>
            <button
              title="Redo"
              aria-label="Redo"
              disabled={locked || preview || !history.future.length}
              onClick={() => dispatch({ type: 'redo' })}
            >
              <Redo2 />
            </button>
          </div>
          <button onClick={() => setPreview((p) => !p)}>
            <Eye />
            {preview ? 'Back to editor' : 'Preview'}
          </button>
          <button
            className="studio-primary"
            disabled={locked || !history.dirty || stale}
            onClick={() => void publish()}
          >
            {publishing ? 'Publishing…' : 'Publish'} <ArrowUp />
          </button>
        </div>
      </header>
      <div className="studio-subbar">
        <div className="studio-page-switch">
          <label>
            <span>Page</span>
            <select aria-label="Page" value={pageKey} onChange={(e) => choosePage(e.target.value)}>
              {Object.keys(site.pages).map((key) => (
                <option key={key} value={key}>
                  {labelFor(key)}
                </option>
              ))}
            </select>
          </label>
          {!preview && (
            <button title="Add page" aria-label="Add page" onClick={() => setNewPage((p) => !p)}>
              <FilePlus2 /> Add page
            </button>
          )}
        </div>
        <div className="studio-devices">
          <button
            aria-label="Desktop preview"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            <Monitor />
          </button>
          <button aria-label="Mobile preview" aria-pressed={mobile} onClick={() => setMobile(true)}>
            <Smartphone />
          </button>
        </div>
        {Object.hasOwn(published.pages, pageKey) ? (
          <Link className="studio-live" target="_blank" rel="noopener" to={schoolPagePath(pageKey)}>
            Live site <ExternalLink />
          </Link>
        ) : (
          <span className="studio-live">Draft page</span>
        )}
      </div>
      {newPage && !preview && (
        <form
          className="studio-new-page"
          onSubmit={(e) => {
            e.preventDefault();
            createPage();
          }}
        >
          <label>
            New page name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </label>
          <label>
            Page template
            <select value={layout} onChange={(e) => setLayout(e.target.value)}>
              {Object.keys(pageLayouts).map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </label>
          {name.trim() && <small>#{schoolPagePath(newPageKey(name, site.pages)!)}</small>}
          <button type="submit" disabled={locked || !name.trim()}>
            Create page
          </button>
          <button type="button" onClick={() => setNewPage(false)}>
            Cancel
          </button>
        </form>
      )}
      <div className={'studio-layout' + (preview ? ' is-preview' : '')}>
        {!preview && (
          <aside className="studio-panel" aria-label="Design tools">
            <div className="studio-tabs">
              <button aria-pressed={tab === 'layers'} onClick={() => setTab('layers')}>
                <Layers /> Layers
              </button>
              <button aria-pressed={tab === 'inspector'} onClick={() => setTab('inspector')}>
                <MousePointer2 /> Inspector
              </button>
            </div>
            <fieldset disabled={publishing} className="studio-panel-fields">
              {tab === 'layers' && (
                <>
                  <div className="studio-panel-heading">
                    <h2>Page layers</h2>
                    <button
                      aria-label="Add section"
                      title="Add section"
                      onClick={() => setTab('library')}
                    >
                      <Plus />
                    </button>
                  </div>
                  <div className="studio-layer-list" onDragOver={over} onDrop={(e) => drop(e)}>
                    <button className="studio-layer" onClick={() => inspect('hero', true)}>
                      <PanelsTopLeft />
                      <span>Page header</span>
                      <ChevronRight />
                    </button>
                    {page.blocks.map((b) => (
                      <button
                        key={b.id}
                        className="studio-layer"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData(dragType, 'move:' + b.id)}
                        onDrop={(e) => drop(e, b.id)}
                        onClick={() => inspect(b.id, true)}
                      >
                        <GripVertical />
                        <span>
                          {b.title || sectionTemplates.find((t) => t.kind === b.kind)?.label}
                        </span>
                        <ChevronRight />
                      </button>
                    ))}
                  </div>
                  <button className="studio-wide" onClick={() => setTab('library')}>
                    <Plus /> Browse sections
                  </button>
                  {!isBuiltInSchoolPage(pageKey) && (
                    <button
                      className="studio-discard"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Remove this page and its navigation link from the draft?',
                          )
                        )
                          return;
                        change((s) => {
                          const pages = { ...s.pages };
                          delete pages[pageKey];
                          return {
                            ...s,
                            pages,
                            navigation: s.navigation.filter(
                              (n) => n.path !== schoolPagePath(pageKey),
                            ),
                          };
                        });
                        choosePage('home');
                      }}
                    >
                      <Trash2 /> Remove page
                    </button>
                  )}
                  <div className="studio-panel-heading">
                    <h2>Website</h2>
                  </div>
                  <button className="studio-layer" onClick={() => inspect('site')}>
                    <Paintbrush />
                    <span>Brand & navigation</span>
                    <ChevronRight />
                  </button>
                  {history.dirty && (
                    <button className="studio-discard" disabled={locked} onClick={discard}>
                      Discard draft
                    </button>
                  )}
                </>
              )}
              {tab === 'library' && (
                <>
                  <div className="studio-panel-heading">
                    <h2>Add a section</h2>
                  </div>
                  <div className="studio-library">
                    {sectionTemplates.map((t) => (
                      <button
                        draggable
                        key={t.kind}
                        onDragStart={(e) => e.dataTransfer.setData(dragType, 'new:' + t.kind)}
                        onClick={() => add(t.kind)}
                      >
                        <span aria-hidden="true" className={'studio-wireframe wire-' + t.kind}>
                          <i />
                          <b />
                          <em />
                        </span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {tab === 'inspector' && (
                <>
                  <div className="studio-panel-heading">
                    <h2>
                      {selectedId === 'site'
                        ? 'Site design'
                        : selectedId === 'hero'
                          ? 'Page settings'
                          : 'Section settings'}
                    </h2>
                    <button
                      aria-label="Add section"
                      title="Add section"
                      onClick={() => setTab('library')}
                    >
                      <Plus />
                    </button>
                  </div>
                  {block && (
                    <div className="studio-actions">
                      <button
                        aria-label="Move section up"
                        disabled={index < 1}
                        onClick={() => move(block.id, index - 1)}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        aria-label="Move section down"
                        disabled={index === page.blocks.length - 1}
                        onClick={() => move(block.id, index + 1)}
                      >
                        <ArrowDown />
                      </button>
                      <button aria-label="Duplicate section" onClick={duplicate}>
                        <Copy />
                      </button>
                      <button
                        aria-label="Delete section"
                        onClick={() => {
                          editPage((p) => ({
                            ...p,
                            blocks: p.blocks.filter((b) => b.id !== block.id),
                          }));
                          setTab('layers');
                          setSelected('hero');
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  )}
                  <SiteInspector
                    key={pageKey + ':' + selectedId}
                    site={site}
                    pageKey={pageKey}
                    selectedId={selectedId}
                    onChange={change}
                    onUploadPending={uploadPending}
                  />
                  {block && (
                    <ElementEditor
                      key={block.id}
                      block={block}
                      onUploadPending={uploadPending}
                      edit={(edit) =>
                        editPage((p) => ({
                          ...p,
                          blocks: p.blocks.map((b) => (b.id === block.id ? edit(b) : b)),
                        }))
                      }
                    />
                  )}
                </>
              )}
            </fieldset>
          </aside>
        )}
        <section
          className="studio-workarea"
          aria-label="Website canvas"
          ref={canvas}
          onDragOver={over}
          onDrop={(e) =>
            drop(
              e,
              (e.target as HTMLElement).closest<HTMLElement>('[data-studio-id]')?.dataset.studioId,
            )
          }
        >
          <div className={'studio-frame' + (mobile ? ' phone-frame' : '')}>
            <div className="studio-address">
              <span className="studio-window-dots" aria-hidden="true">
                ● ● ●
              </span>
              <Globe2 />
              {schoolPagePath(pageKey)}
            </div>
            <MediaEditContext.Provider
              value={
                preview || publishing
                  ? undefined
                  : (target, layout) => editPage((p) => resizePageMedia(p, target, layout))
              }
            >
              <SchoolSiteCanvas
                site={site}
                pageKey={pageKey}
                onSelect={preview ? undefined : (id) => inspect(id)}
                selectedId={preview ? undefined : selectedId}
                onNavigatePage={choosePage}
                selectedElementId={preview ? undefined : elementId}
                onSelectElement={
                  preview
                    ? undefined
                    : (sectionId, id) => {
                        inspect(sectionId);
                        setElementId(id);
                        requestAnimationFrame(() => focusElementInspector(id));
                      }
                }
                onMoveElement={
                  preview || locked
                    ? undefined
                    : (move) => {
                        editPage((p) => moveWebsiteElement(p, move));
                        inspect(move.toSectionId);
                      }
                }
              />
            </MediaEditContext.Provider>
          </div>
        </section>
      </div>
      <footer className="studio-status" role="status">
        <Check />
        {problem ||
          (stale
            ? 'The published site changed. Your draft is still on this browser.'
            : notice ||
              (uploads
                ? 'Uploading image…'
                : history.dirty
                  ? 'Draft saved on this browser'
                  : 'Published version'))}
        {stale && <button onClick={discard}>Load published site</button>}
      </footer>
    </main>
  );
}
