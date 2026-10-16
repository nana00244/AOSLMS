import { useEffect, useState, useRef, type ImgHTMLAttributes } from 'react';
import { cachedPhotoUrl, resolvePhotoUrl } from '../photoUrls';
export function StudentPhoto({
  photo,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { photo: string }) {
  const [resolved, setResolved] = useState<{ photo: string; url?: string }>({
    photo,
    url: cachedPhotoUrl(photo),
  });
  const retried = useRef(false);
  useEffect(() => {
    let active = true;
    retried.current = false;
    void resolvePhotoUrl(photo)
      .then((url) => {
        if (active) setResolved({ photo, url });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [photo]);
  const url = cachedPhotoUrl(photo) || (resolved.photo === photo ? resolved.url : undefined);
  return (
    <img
      {...props}
      src={url}
      onError={() => {
        if (retried.current) return;
        retried.current = true;
        void resolvePhotoUrl(photo, true)
          .then((url) => setResolved({ photo, url }))
          .catch(() => {});
      }}
    />
  );
}
