import { useEffect, useRef } from 'react';

const clips = { correct: 'cute-wow-yeye.mp3', wrong: 'wrong-answer-gameshow.mp3' };
type Outcome = keyof typeof clips;

export function useAnswerSounds() {
  const context = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<Outcome, Promise<AudioBuffer>>());
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const version = useRef(0);

  useEffect(() => () => {
    version.current++;
    if (context.current) void context.current.close().catch(() => {});
    context.current = null;
    sources.current.clear();
    buffers.current.clear();
  }, []);

  // Unlock audio on the submit gesture even when the results arrive asynchronously.
  return function prepareSound() {
    const current = ++version.current;
    try {
      for (const source of sources.current) source.stop();
      const audio = context.current ??= new AudioContext();
      const ready = audio.resume().then(() => true, () => false);
      function load(outcome: Outcome) {
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
      return (results: boolean[]) => {
        void Promise.all([ready, Promise.all(results.map((ok) => load(ok ? 'correct' : 'wrong')))])
          .then(([enabled, sounds]) => {
            if (!enabled || version.current !== current) return;
            let when = audio.currentTime;
            for (const buffer of sounds) {
              const source = audio.createBufferSource();
              source.buffer = buffer;
              source.connect(audio.destination);
              sources.current.add(source);
              source.onended = () => {
                source.disconnect();
                sources.current.delete(source);
              };
              source.start(when);
              when += buffer.duration;
            }
          }).catch(() => {});
      };
    } catch {
      return () => {};
    }
  };
}
