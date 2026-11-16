import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Heart,
  Menu,
  Microscope,
  Pencil,
  Trophy,
  X,
} from 'lucide-react';
import type { SchoolWebsiteBlock, SchoolWebsiteContent } from '../data';
import { schoolPagePath } from '../schoolWebsiteModel';
import { SectionElements } from './SectionElements';
import { WebsiteMedia } from './WebsiteMedia';
import { SchoolCarousel } from './SchoolCarousel';
import { useCanvasElementDrag } from './useCanvasElementDrag';
import type { WebsiteElementMove } from './websiteElementMove';
import { schoolLinkDestination } from './schoolSiteLinks';
import './school-site-canvas.css';

type CanvasProps = {
  site: SchoolWebsiteContent;
  pageKey: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onNavigatePage?: (key: string) => void;
  selectedElementId?: string;
  onSelectElement?: (sectionId: string, elementId: string) => void;
  onMoveElement?: (move: WebsiteElementMove) => void;
};

/** Choose the higher-contrast of white and black for an editor-selected colour. */
function contrastingInk(color?: string) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const channels = [1, 3, 5].map((start) => {
    const srgb = parseInt(color.slice(start, start + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance + 0.05 > Math.sqrt(0.0525) ? '#000' : '#fff';
}

function SiteLink({
  to,
  children,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  'aria-current'?: 'page';
}) {
  const href = schoolLinkDestination(to);
  if (!href) return <span className={props.className}>{children}</span>;
  return href.startsWith('/') ? (
    <Link {...props} to={href}>
      {children}
    </Link>
  ) : (
    <a {...props} href={href}>
      {children}
    </a>
  );
}

function Brand({ site }: { site: SchoolWebsiteContent }) {
  return (
    <SiteLink to="/school" className="school-brand">
      <span className="school-seal">
        {site.logo ? <img src={site.logo} alt="" /> : <GraduationCap />}
      </span>
      <span>
        {site.brandName}
        <small>{site.brandSubtitle}</small>
      </span>
    </SiteLink>
  );
}

function SchoolIllustration({ site }: { site: SchoolWebsiteContent }) {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="visual-orbit orbit-one" />
      <div className="visual-orbit orbit-two" />
      <div className="visual-sun" />
      <div className="visual-hill hill-back" />
      <div className="visual-hill hill-front" />
      <div className="visual-school">
        <div className="school-roof" />
        <div className="school-building">
          <div className="school-building-name">{site.brandName}</div>
          <div className="school-windows">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="school-door" />
        </div>
        <div className="school-flag" />
      </div>
      {site.pages.learning?.title && (
        <span className="floating-label label-top">{site.pages.learning.title}</span>
      )}
    </div>
  );
}

function ActionLink({ section }: { section: SchoolWebsiteBlock }) {
  if (!section.actionLabel || !schoolLinkDestination(section.actionPath)) return null;
  return (
    <SiteLink className="school-button" to={section.actionPath}>
      {section.actionLabel}
      <ArrowRight size={17} />
    </SiteLink>
  );
}

function SectionHeading({ section }: { section: SchoolWebsiteBlock }) {
  return (
    <div className="site-section-heading">
      {section.eyebrow && (
        <p className="school-kicker" style={section.textStyles?.eyebrow}>
          {section.eyebrow}
        </p>
      )}
      {section.title && <h2 style={section.textStyles?.title}>{section.title}</h2>}
      {section.body && <p style={section.textStyles?.body}>{section.body}</p>}
    </div>
  );
}

const icons = {
  graduation: GraduationCap,
  book: BookOpen,
  heart: Heart,
  science: Microscope,
  award: Trophy,
};

function BlockContent({
  section,
  site,
}: {
  section: SchoolWebsiteBlock;
  site: SchoolWebsiteContent;
}) {
  switch (section.kind) {
    case 'text':
      return (
        <div className="home-about">
          <div className="home-about-art">
            {section.image ? (
              <WebsiteMedia
                variant="story"
                src={section.image}
                target={{ blockId: section.id }}
                layout={section.mediaLayout}
              />
            ) : site.logo ? (
              <img className="school-art-logo" alt="" src={site.logo} />
            ) : (
              <div className="art-circle">
                <GraduationCap size={56} />
              </div>
            )}
          </div>
          <SectionHeading section={section} />
        </div>
      );
    case 'quote':
      return (
        <div className="school-quote">
          <span aria-hidden="true">“</span>
          <blockquote style={section.textStyles?.title}>{section.title}</blockquote>
          {section.body && <p style={section.textStyles?.body}>{section.body}</p>}
        </div>
      );
    case 'cta':
      return (
        <div className="school-cta">
          <SectionHeading section={section} />
          <ActionLink section={section} />
        </div>
      );
    case 'cards':
      return (
        <div className="school-learning">
          <SectionHeading section={section} />
          <div className="learning-cards">
            {section.items.map((entry) => {
              const Icon = icons[entry.icon as keyof typeof icons] || GraduationCap;
              return (
                <article key={entry.id}>
                  {entry.image ? (
                    <WebsiteMedia
                      variant="card"
                      src={entry.image}
                      alt={entry.title}
                      target={{ blockId: section.id, itemId: entry.id }}
                      layout={entry.mediaLayout}
                    />
                  ) : (
                    <span className="learning-icon">
                      {entry.icon === 'graduation' && site.logo ? (
                        <img className="school-icon-logo" src={site.logo} alt="" />
                      ) : (
                        <Icon />
                      )}
                    </span>
                  )}
                  {entry.detail && <p style={entry.textStyles?.detail}>{entry.detail}</p>}
                  <h3 style={entry.textStyles?.title}>{entry.title}</h3>
                  <small style={entry.textStyles?.body}>{entry.body}</small>
                </article>
              );
            })}
          </div>
        </div>
      );
    case 'carousel':
      return (
        <div className="school-learning">
          <SectionHeading section={section} />
          <SchoolCarousel section={section} />
        </div>
      );
    case 'gallery':
      return (
        <div className="school-gallery school-learning">
          <SectionHeading section={section} />
          <div className="school-gallery-grid">
            {section.items
              .filter((entry) => entry.image)
              .map((entry) => (
                <figure key={entry.id}>
                  <WebsiteMedia
                    variant="gallery"
                    src={entry.image}
                    alt={entry.title}
                    target={{ blockId: section.id, itemId: entry.id }}
                    layout={entry.mediaLayout}
                  />
                  {entry.body && (
                    <figcaption style={entry.textStyles?.body}>{entry.body}</figcaption>
                  )}
                </figure>
              ))}
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="school-faq school-learning">
          <SectionHeading section={section} />
          <div className="school-faq-list">
            {section.items.map((entry) => (
              <details key={entry.id}>
                <summary style={entry.textStyles?.title}>
                  {entry.title}
                  <ChevronDown size={18} />
                </summary>
                <p style={entry.textStyles?.body}>{entry.body}</p>
              </details>
            ))}
          </div>
        </div>
      );
    case 'divider':
      return (
        <div className="school-divider">
          <hr />
        </div>
      );
    case 'blank':
      return null;
  }
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="school-select-region"
      aria-label={`Edit ${label}`}
      onClick={onClick}
    >
      <Pencil size={12} />
      {label}
    </button>
  );
}

function CanvasSection({
  section,
  site,
  selectedId,
  onSelect,
  selectedElementId,
  editElements,
  moveElements,
  dropTarget,
}: Pick<CanvasProps, 'site' | 'onSelect' | 'selectedId' | 'selectedElementId'> & {
  section: SchoolWebsiteBlock;
  editElements: boolean;
  moveElements: boolean;
  dropTarget: ReturnType<typeof useCanvasElementDrag>['target'];
}) {
  const ref = useRef<HTMLElement>(null);
  const effect = section.design?.effect;
  useEffect(() => {
    const node = ref.current;
    if (!node || !effect || effect === 'none' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        node.dataset.entered = 'true';
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      delete node.dataset.entered;
    };
  }, [effect]);

  return (
    <section
      ref={ref}
      className={`school-canvas-section school-region school-block-${section.kind}`}
      data-edit-id={section.id}
      data-studio-id={onSelect ? section.id : undefined}
      data-element-append={dropTarget && !dropTarget.elementId ? true : undefined}
      data-selected={Boolean(onSelect && selectedId === section.id)}
      data-spacing={section.design?.spacing}
      data-align={section.design?.align}
      data-effect={effect}
      data-hide-mobile={section.design?.hideOnMobile}
      data-background={Boolean(section.design?.background)}
      style={
        {
          backgroundColor: section.design?.background,
          textAlign: section.design?.align,
          '--section-ink': contrastingInk(section.design?.background),
        } as CSSProperties
      }
    >
      {onSelect && (
        <EditButton label={section.title || section.kind} onClick={() => onSelect(section.id)} />
      )}
      <BlockContent site={site} section={section} />
      {onSelect && section.kind === 'blank' && !section.elements?.length && (
        <button type="button" className="school-blank-section" onClick={() => onSelect(section.id)}>
          Add elements to this section
        </button>
      )}
      <SectionElements
        blockId={section.id}
        elements={section.elements}
        editable={editElements}
        movable={moveElements}
        selectedElementId={selectedId === section.id ? selectedElementId : undefined}
        dropMarker={
          dropTarget?.elementId ? { id: dropTarget.elementId, edge: dropTarget.edge } : undefined
        }
      />
    </section>
  );
}

export function SchoolSiteCanvas({
  site,
  pageKey,
  onNavigatePage,
  onSelect,
  selectedId,
  onMoveElement,
  onSelectElement,
  selectedElementId,
}: CanvasProps) {
  const page = site.pages[pageKey] || site.pages.home;
  const drag = useCanvasElementDrag(page.blocks, onSelect ? onMoveElement : undefined);
  const home = pageKey === 'home';
  const [menu, setMenu] = useState(false);
  const navId = useId();
  const cta = page.blocks.find(
    (section) =>
      section.kind === 'cta' && section.actionLabel && schoolLinkDestination(section.actionPath),
  );
  useEffect(() => {
    setMenu(false);
  }, [pageKey]);

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        '.school-menu-btn, .school-select-region, .school-blank-section, .website-media-tools, .slide-controls, video',
      )
    )
      return;
    const link = target.closest('a');
    const id = target.closest<HTMLElement>('[data-edit-id]')?.dataset.editId;
    const elementId = target.closest<HTMLElement>('[data-canvas-element]')?.dataset.canvasElement;
    if (onSelect && onSelectElement && id && elementId) {
      event.preventDefault();
      event.stopPropagation();
      onSelectElement(id, elementId);
      return;
    }
    if (onSelect && id && (!link || id !== 'site')) {
      // A click on the editable surface selects the same region as its keyboard control.
      if (link) event.preventDefault();
      onSelect(id);
      if (link) event.stopPropagation();
      return;
    }
    if (!link) return;
    setMenu(false);
    if (!onNavigatePage && !onSelect) return;
    // Keep interactions with a draft inside the editor, including the LMS portal.
    event.preventDefault();
    event.stopPropagation();
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const path = url.hash.startsWith('#/') ? url.hash.slice(1) : url.pathname;
    const key = Object.keys(site.pages).find((key) => schoolPagePath(key) === path);
    if (key) onNavigatePage?.(key);
  }

  const themeStyle = {
    '--forest': site.theme?.accent,
    '--site-font': site.theme?.fontFamily,
    '--accent-ink': contrastingInk(site.theme?.accent),
    '--heading-ink':
      contrastingInk(site.theme?.accent) === '#000'
        ? 'color-mix(in srgb, var(--forest) 50%, #101820)'
        : site.theme?.accent,
  } as CSSProperties;
  const heroText = (
    <>
      {page.eyebrow && (
        <p className="school-kicker" style={page.textStyles?.eyebrow}>
          {home && <span />}
          {page.eyebrow}
        </p>
      )}
      <h1 style={page.textStyles?.title}>{page.title}</h1>
      {page.intro && <p style={page.textStyles?.intro}>{page.intro}</p>}
    </>
  );
  return (
    <div
      className="school-site school-canvas"
      data-editing={Boolean(onSelect)}
      data-theme-color={Boolean(site.theme?.accent)}
      data-theme-font={Boolean(site.theme?.fontFamily)}
      style={themeStyle}
      onClickCapture={handleCanvasClick}
      {...drag.handlers}
    >
      <div
        className="school-topline school-region"
        data-edit-id="site"
        data-selected={Boolean(onSelect && selectedId === 'site')}
      >
        <span>{site.topLineLeft}</span>
        <span>{site.topLineRight}</span>
      </div>
      <header
        className="school-header school-region"
        data-edit-id="site"
        data-selected={Boolean(onSelect && selectedId === 'site')}
      >
        {onSelect && <EditButton label="site branding" onClick={() => onSelect('site')} />}
        <Brand site={site} />
        <button
          type="button"
          className="school-menu-btn"
          aria-label="Toggle navigation"
          aria-expanded={menu}
          aria-controls={navId}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        <nav
          id={navId}
          aria-label="School navigation"
          className={menu ? 'school-nav open' : 'school-nav'}
        >
          {site.navigation.map((link, index) => (
            <SiteLink
              key={`${link.path}-${index}`}
              to={link.path}
              aria-current={schoolPagePath(pageKey) === link.path ? 'page' : undefined}
            >
              {link.label}
            </SiteLink>
          ))}
          <SiteLink className="school-lms" to="/">
            <BookOpen size={16} />
            {site.lmsLabel}
          </SiteLink>
        </nav>
      </header>
      <section
        className={`school-region ${home ? 'school-hero' : 'school-page-hero'}`}
        data-edit-id="hero"
        data-studio-id={onSelect ? 'hero' : undefined}
        data-selected={Boolean(onSelect && selectedId === 'hero')}
      >
        {onSelect && <EditButton label="page hero" onClick={() => onSelect('hero')} />}
        {home ? (
          <div className="hero-copy">
            {heroText}
            {cta && (
              <div className="hero-actions" data-hide-mobile={cta.design?.hideOnMobile}>
                <ActionLink section={cta} />
              </div>
            )}
          </div>
        ) : (
          heroText
        )}
        {page.image ? (
          <WebsiteMedia variant="hero" src={page.image} target={{}} layout={page.mediaLayout} />
        ) : (
          home && <SchoolIllustration site={site} />
        )}
      </section>
      {page.blocks.map((section) => (
        <CanvasSection
          key={section.id}
          section={section}
          site={site}
          selectedId={selectedId}
          onSelect={onSelect}
          editElements={Boolean(onSelect && onSelectElement)}
          moveElements={Boolean(onSelect && onMoveElement)}
          selectedElementId={selectedElementId}
          dropTarget={drag.target?.sectionId === section.id ? drag.target : null}
        />
      ))}
      <footer
        className="school-footer school-region"
        data-edit-id="site"
        data-selected={Boolean(onSelect && selectedId === 'site')}
      >
        <Brand site={site} />
        <div>
          <p>{site.footerNote}</p>
          <p>
            © {new Date().getFullYear()} {site.brandName} {site.brandSubtitle}
          </p>
        </div>
        <SiteLink to="/">
          {site.lmsLabel} <ArrowRight size={16} />
        </SiteLink>
      </footer>
    </div>
  );
}
