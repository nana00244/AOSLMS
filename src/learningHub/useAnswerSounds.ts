import { useEffect, useRef } from 'react';

const clips = {
  correct: 'cute-wow-yeye.mp3',
  wrong: 'wrong-answer-gameshow.mp3',
  skipped: 'run-vine.mp3',
  practice: 'practice-start-preview.mp3',
};
export type Outcome = keyof typeof clips;
const outcomes = Object.keys(clips) as Outcome[];

export function useAnswerSounds() {
  const context = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<Outcome, Promise<AudioBuffer>>());
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const version = useRef(0);

  function getContext() {
    return (context.current ??= new AudioContext());
  }

  function load(outcome: Outcome, audio: AudioContext) {
    const cached = buffers.current.get(outcome);
    if (cached) return cached;
    const buffer = fetch(import.meta.env.BASE_URL + 'assets/' + clips[outcome])
      .then((response) => {
        if (!response.ok) throw new Error('Sound unavailable');
        return response.arrayBuffer();
      })
      .then((bytes) => audio.decodeAudioData(bytes))
      .catch((error) => {
        if (context.current === audio) buffers.current.delete(outcome);
        throw error;
      });
    buffers.current.set(outcome, buffer);
    return buffer;
  }

  useEffect(() => {
    try {
      const audio = getContext();
      // Fetch and decode before the learner needs feedback; resume remains gesture-gated.
      for (const outcome of outcomes) void load(outcome, audio).catch(() => {});
    } catch {
      // Audio is optional; the practice flow continues if the browser lacks Web Audio.
    }

    return () => {
      version.current++;
      if (context.current) void context.current.close().catch(() => {});
      context.current = null;
      sources.current.clear();
      buffers.current.clear();
    };
  }, []);

  // Unlock audio on the submit gesture even when the results arrive asynchronously.
  return function prepareSound() {
    const current = ++version.current;
    try {
      for (const source of sources.current) source.stop();
      const audio = getContext();
      const ready = audio.resume().then(() => true, () => false);
      return (results: Outcome[]) => {
        void Promise.all([ready, Promise.all(results.map((outcome) => load(outcome, audio)))])
          .then(([enabled, sounds]) => {
            if (!enabled || version.current !== current) return;
            let when = audio.currentTime;
            for (const [index, buffer] of sounds.entries()) {
              const source = audio.createBufferSource();
              source.buffer = buffer;
              source.connect(audio.destination);
              sources.current.add(source);
              source.onended = () => {
                source.disconnect();
                sources.current.delete(source);
              };
              const duration = results[index] === 'practice' ? Math.min(3, buffer.duration) : buffer.duration;
              source.start(when, 0, duration);
              when += duration;
            }
          }).catch(() => {});
      };
    } catch {
      return () => {};
    }
  };
}
