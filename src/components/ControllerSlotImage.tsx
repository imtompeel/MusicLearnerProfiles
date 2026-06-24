import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  REPEAT_ANIMATION_CLASS,
  type SlotAnimation
} from '../data/controllerAnimations';
import { loadControllerSlotImageBlobUrl } from '../utils/controllerImageStorage';
import { captureFrameFromImageElement } from '../utils/gifDuration';

interface ControllerSlotImageProps {
  url?: string;
  storagePath?: string;
  alt: string;
  fallback: string;
  className?: string;
  imageClassName?: string;
  repeatAnimation?: SlotAnimation;
  isAnimating?: boolean;
  isFirstReveal?: boolean;
  isAnimatedGif?: boolean;
  gifPosterUrl?: string;
  gifLoopDurationMs?: number;
}

type GifDisplayMode = 'poster' | 'playing' | 'paused';

const restartableSrc = (src: string, token: number): string => {
  if (src.startsWith('blob:') || src.startsWith('data:')) {
    const hash = src.includes('#') ? src.slice(src.indexOf('#')) : '';
    return hash ? `${src.split('#')[0]}#gifplay=${token}` : `${src}#gifplay=${token}`;
  }

  const base = src.split('#')[0];
  const hash = src.includes('#') ? src.slice(src.indexOf('#')) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}gifplay=${token}${hash}`;
};

const isLocalImageUrl = (src: string): boolean =>
  src.startsWith('data:') || src.startsWith('blob:');

export const ControllerSlotImage: React.FC<ControllerSlotImageProps> = ({
  url,
  storagePath,
  alt,
  fallback,
  className = '',
  imageClassName = '',
  repeatAnimation = 'jiggle',
  isAnimating = false,
  isFirstReveal = false,
  isAnimatedGif = false,
  gifPosterUrl
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [appearDone, setAppearDone] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(gifPosterUrl ?? null);
  const [pausedFrameUrl, setPausedFrameUrl] = useState<string | null>(null);
  const [gifDisplayMode, setGifDisplayMode] = useState<GifDisplayMode>(() =>
    isAnimatedGif && isAnimating ? 'playing' : 'poster'
  );
  const [gifPlayToken, setGifPlayToken] = useState(0);
  const [gifBlobUrl, setGifBlobUrl] = useState<string | null>(null);
  const wasAnimatingRef = useRef(isAnimating);
  const isAnimatingRef = useRef(isAnimating);
  const gifDisplayModeRef = useRef<GifDisplayMode>(gifDisplayMode);
  const imgRef = useRef<HTMLImageElement>(null);

  gifDisplayModeRef.current = gifDisplayMode;
  isAnimatingRef.current = isAnimating;

  const idleFrameUrl = pausedFrameUrl ?? posterUrl ?? undefined;

  useEffect(() => {
    setImgFailed(false);
  }, [url, storagePath]);

  useEffect(() => {
    if (isFirstReveal) {
      setAppearDone(false);
    }
  }, [isFirstReveal]);

  useEffect(() => {
    setPosterUrl(gifPosterUrl ?? null);
  }, [gifPosterUrl]);

  useEffect(() => {
    if (!isAnimatedGif) return;
    setPausedFrameUrl(null);
    setGifPlayToken(0);
  }, [url, storagePath, isAnimatedGif]);

  useEffect(() => {
    if (!isAnimatedGif) {
      setGifBlobUrl(null);
      return;
    }

    if (url && isLocalImageUrl(url)) {
      setGifBlobUrl(url);
      return;
    }

    if (!storagePath) {
      setGifBlobUrl(null);
      return;
    }

    let cancelled = false;

    void loadControllerSlotImageBlobUrl(storagePath)
      .then((blobUrl) => {
        if (!cancelled) {
          setGifBlobUrl(blobUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGifBlobUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAnimatedGif, storagePath, url]);

  useLayoutEffect(() => {
    if (!isAnimatedGif) return;

    const wasAnimating = wasAnimatingRef.current;
    wasAnimatingRef.current = isAnimating;

    if (isAnimating && !wasAnimating) {
      setGifPlayToken((token) => token + 1);
      setGifDisplayMode('playing');
      setImgFailed(false);
      return;
    }

    if (!isAnimating && wasAnimating) {
      const img = imgRef.current;
      const frame =
        gifDisplayModeRef.current === 'playing' &&
        img &&
        img.complete &&
        img.naturalWidth > 0
          ? captureFrameFromImageElement(img)
          : null;
      if (frame) {
        setPausedFrameUrl(frame);
      }
      setGifDisplayMode('paused');
    }
  }, [isAnimating, isAnimatedGif]);

  const animatedBaseSrc = gifBlobUrl ?? url;
  const playingSrc =
    gifDisplayMode === 'playing' && animatedBaseSrc
      ? restartableSrc(animatedBaseSrc, gifPlayToken)
      : undefined;

  const displaySrc = isAnimatedGif
    ? gifDisplayMode === 'playing'
      ? playingSrc
      : idleFrameUrl
    : url;

  const showImage = isAnimatedGif ? Boolean(displaySrc) : Boolean(url) && !imgFailed;

  const showAppear = isFirstReveal && isAnimating && !appearDone;
  const showLoop = isAnimating && (!isFirstReveal || appearDone);

  const handleImageError = () => {
    if (isAnimatedGif) {
      if (isAnimatingRef.current) {
        return;
      }
      if (idleFrameUrl) return;
    }
    setImgFailed(true);
  };

  return (
    <div
      className={[
        'controller-slot-image',
        isAnimatedGif ? 'is-gif' : '',
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
      {showImage && displaySrc ? (
        <img
          ref={isAnimatedGif ? imgRef : undefined}
          key={
            isAnimatedGif && gifDisplayMode === 'playing'
              ? `gif-play-${gifPlayToken}`
              : 'gif-static'
          }
          src={displaySrc}
          alt={alt}
          className={[imageClassName, isAnimatedGif ? 'slot-gif-image' : ''].filter(Boolean).join(' ')}
          referrerPolicy="no-referrer"
          onError={handleImageError}
        />
      ) : (
        <span className="controller-slot-fallback">{fallback}</span>
      )}
    </div>
  );
};

export const isAnimatedGifUrl = (url?: string): boolean =>
  Boolean(url && (/\.gif($|[?#])/i.test(url) || url.startsWith('data:image/gif')));

export const isAnimatedGifStoragePath = (storagePath?: string): boolean =>
  Boolean(storagePath && /\.gif$/i.test(storagePath));
