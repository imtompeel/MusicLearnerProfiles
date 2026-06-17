import React, { useEffect, useRef, useState } from 'react';
import {
  REPEAT_ANIMATION_CLASS,
  type SlotAnimation
} from '../data/controllerAnimations';

const ALL_ANIM_CLASSES = ['anim-appear', ...Object.values(REPEAT_ANIMATION_CLASS)];

interface ControllerSlotImageProps {
  url?: string;
  alt: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  repeatAnimation?: SlotAnimation;
  animateToken?: number;
  isFirstReveal?: boolean;
}

export const ControllerSlotImage: React.FC<ControllerSlotImageProps> = ({
  url,
  alt,
  fallback,
  className = '',
  imageClassName = '',
  repeatAnimation = 'jiggle',
  animateToken = 0,
  isFirstReveal = false
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  useEffect(() => {
    if (!animateToken) return;
    const el = contentRef.current;
    if (!el) return;
    ALL_ANIM_CLASSES.forEach((cls) => el.classList.remove(cls));
    void el.offsetWidth;
    el.classList.add(REPEAT_ANIMATION_CLASS[repeatAnimation]);
  }, [animateToken, repeatAnimation]);

  const showImage = Boolean(url) && !imgFailed;

  return (
    <div
      ref={contentRef}
      className={[
        'controller-slot-image',
        className,
        isFirstReveal ? 'anim-appear' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showImage ? (
        <img
          src={url}
          alt={alt}
          className={imageClassName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="controller-slot-fallback">{fallback}</span>
      )}
    </div>
  );
};
