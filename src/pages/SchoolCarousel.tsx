import { useContext, useEffect, useState } from 'react';
import type { SchoolWebsiteBlock } from '../data';
import { MediaEditContext, WebsiteMedia } from './WebsiteMedia';

export function SchoolCarousel({ section }: { section: SchoolWebsiteBlock }) {
  const editing = Boolean(useContext(MediaEditContext));
  const slides = section.items.filter((item) => item.image);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [playing, setPlaying] = useState(false);
  const active = index % Math.max(1, slides.length);
  const slide = slides[active];
  useEffect(() => {
    if (editing || paused || playing || slides.length < 2) return;
    const timer = window.setInterval(
      () => {
        if (!document.hidden) setIndex((i) => (i + 1) % slides.length);
      },
      (section.slideSeconds ?? 5) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [editing, paused, playing, slides.length, section.slideSeconds, active]);
  function advance(step: number) {
    setPlaying(false);
    setIndex((active + step + slides.length) % slides.length);
  }
  if (!slide) return editing ? <p>Add photos or videos in the carousel settings.</p> : null;
  return (
    <div
      className="school-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={section.title || 'School slideshow'}
    >
      <div className="carousel-window" aria-live={paused ? 'polite' : 'off'}>
        <figure key={slide.id}>
          <WebsiteMedia
            src={slide.image}
            alt={slide.title}
            target={{ blockId: section.id, itemId: slide.id }}
            layout={slide.mediaLayout}
            variant="slide"
            onPlayingChange={setPlaying}
          />
          {slide.body && <figcaption style={slide.textStyles?.body}>{slide.body}</figcaption>}
        </figure>
      </div>
      {slides.length > 1 && (
        <div className="slide-controls">
          <button type="button" aria-label="Previous slide" onClick={() => advance(-1)}>
            Previous
          </button>
          <span>
            {active + 1} / {slides.length}
          </span>
          <button type="button" aria-label="Next slide" onClick={() => advance(1)}>
            Next
          </button>
          {!editing && (
            <button type="button" onClick={() => setPaused((p) => !p)}>
              {paused ? 'Play slideshow' : 'Pause slideshow'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
