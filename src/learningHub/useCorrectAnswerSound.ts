import { useEffect, useRef } from 'react';

export function useCorrectAnswerSound() {
  const context = useRef<AudioContext | null>(null);
  const clip = useRef<Promise<AudioBuffer> | null>(null);
  const active = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => () => {
    if (context.current) void context.current.close().catch(() => {});
    context.current = null;
    clip.current = null;
    active.current = null;
  }, []);

  // Resume during the submit gesture, including when grading finishes on the server.
  return function prepareSound() {
    try {
      const audio = context.current ??= new AudioContext();
      const ready = audio.resume();
      clip.current ??= fetch(import.meta.env.BASE_URL + 'assets/correct-answer.mp3')
        .then((response) => {
          if (!response.ok) throw new Error('Sound unavailable');
          return response.arrayBuffer();
        })
        .then((bytes) => audio.decodeAudioData(bytes))
        .catch((error) => {
          if (context.current === audio) clip.current = null;
          throw error;
        });
      const loaded = Promise.all([ready, clip.current]).catch(() => null);
      return (count = 1) => {
        if (count < 1) return;
        void loaded.then((result) => {
          if (!result || context.current !== audio) return;
          active.current?.stop();
          const source = audio.createBufferSource();
          source.buffer = result[1];
          source.loop = count > 1;
          source.connect(audio.destination);
          source.onended = () => {
            source.disconnect();
            if (active.current === source) active.current = null;
          };
          active.current = source;
          source.start(0, 0, source.buffer.duration * count);
        }).catch(() => {});
      };
    } catch {
      return () => {};
    }
  };
}
