import React, { useEffect, useState } from 'react';
import {
  REPEAT_ANIMATION_CLASS,
  type SlotAnimation
} from '../data/controllerAnimations';

interface ControllerSlotImageProps {
  url?: string;
  alt: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  repeatAnimation?: SlotAnimation;
  isAnimating?: boolean;
  isFirstReveal?: boolean;
}

export const ControllerSlotImage: React.FC<ControllerSlotImageProps> = ({
  url,
  alt,
  fallback,
  className = '',
  imageClassName = '',
  repeatAnimation = 'jiggle',
  isAnimating = false,
  isFirstReveal = false
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [appearDone, setAppearDone] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  useEffect(() => {
    if (isFirstReveal) {
      setAppearDone(false);
    }
  }, [isFirstReveal]);

  const showImage = Boolean(url) && !imgFailed;
  const showAppear = isFirstReveal && isAnimating && !appearDone;
  const showLoop = isAnimating && (!isFirstReveal || appearDone);

  return (
    <div
      className={[
        'controller-slot-image',
        className,
        showAppear ? 'anim-appear' : '',
        showLoop ? 'anim-loop' : '',
        showLoop ? REPEAT_ANIMATION_CLASS[repeatAnimation] : ''
      ]
        .filter(Boolean)
        .join(' ')}
      onAnimationEnd={(event) => {
        if (event.animationName === 'midi-image-appear') {
          setAppearDone(true);
        }
      }}
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
