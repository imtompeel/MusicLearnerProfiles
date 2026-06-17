// Image utility functions for pattern matching questions

export interface ImageSource {
  url: string;
  alt: string;
  fallback: string; // emoji fallback
}

const termQueryOverrides: { [key: string]: string } = {
  flute: 'flute isolated',
  clarinet: 'clarinet musical instrument woodwind isolated',
  saxophone: 'saxophone musical instrument isolated',
  trumpet: 'trumpet musical instrument brass isolated',
  trombone: 'trombone musical instrument brass isolated',
  violin: 'violin musical instrument strings isolated',
  piano: 'piano musical instrument keys isolated',
  drum: 'drum musical instrument percussion isolated',
  guitar: 'guitar musical instrument strings isolated',
  shaker: 'maraca musical instrument percussion isolated',
  rain: 'rain weather icon',
  clock: 'clock face time icon',
  vacuum: 'cleaner',
  cat: 'cat animal icon',
  dog: 'dog',
  bird: 'bird animal icon',
  cow: 'cow animal icon',
  star: 'gold star',
  rainbow: 'rainbow sky',
  balloon: 'colourful balloon party'
};

const defaultEmojiFallbacks: { [key: string]: string } = {
  dog: '🐕',
  cat: '🐱',
  bird: '🐦',
  cow: '🐄',
  clock: '🕐',
  heart: '❤️',
  drum: '🥁',
  rain: '🌧️',
  star: '⭐',
  rainbow: '🌈',
  balloon: '🎈'
};

const termToImageCache: { [key: string]: ImageSource } = {};

const FETCH_TIMEOUT_MS = 12_000;
const FETCH_RETRIES = 2;
const FETCH_RETRY_DELAY_MS = 800;
const BETWEEN_REQUEST_DELAY_MS = 350;

export const hasUnsplashApiKey = (): boolean => {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  return Boolean(accessKey && accessKey !== 'your_unsplash_access_key_here');
};

const emojiForTerm = (key: string): string =>
  defaultEmojiFallbacks[key.toLowerCase()] || '🖼️';

const buildImageSource = (key: string, url: string): ImageSource => ({
  url,
  alt: key,
  fallback: emojiForTerm(key)
});

const isValidCachedSource = (source?: ImageSource): boolean =>
  Boolean(source?.url);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same-origin proxy in dev (see vite.config.ts); direct API in production builds. */
const getUnsplashApiBase = (): string =>
  import.meta.env.DEV ? '/api/unsplash' : 'https://api.unsplash.com';

const getPlaceholderImageUrl = (term: string, width: number, height: number): string =>
  `https://picsum.photos/seed/${encodeURIComponent(term.toLowerCase())}/${width}/${height}`;

export const clearPatternImageCache = (keys?: string[]): void => {
  if (!keys) {
    Object.keys(termToImageCache).forEach((key) => delete termToImageCache[key]);
    return;
  }
  keys.forEach((key) => {
    delete termToImageCache[key.trim()];
  });
};

const fetchWithRetry = async (url: string, init?: RequestInit): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);
      return response;
    } catch (error) {
      window.clearTimeout(timeoutId);
      lastError = error;
      if (attempt < FETCH_RETRIES) {
        await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
};

export const getUnsplashImageUrl = async (
  searchTerm: string,
  width: number = 200,
  height: number = 200
): Promise<string> => {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  if (!hasUnsplashApiKey()) {
    return getPlaceholderImageUrl(searchTerm, width, height);
  }

  const override = termQueryOverrides[searchTerm.toLowerCase()];
  const query = override || searchTerm;
  const encodedTerm = encodeURIComponent(query);
  const apiUrl =
    `${getUnsplashApiBase()}/search/photos?query=${encodedTerm}` +
    `&per_page=3&content_filter=high&order_by=relevant&orientation=squarish&client_id=${accessKey}`;

  try {
    const response = await fetchWithRetry(apiUrl, {
      headers: {
        'Accept-Version': 'v1'
      }
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const selectedImage = data.results[0];
      const baseUrl = selectedImage.urls.small as string;
      return `${baseUrl}&w=${width}&h=${height}&fit=crop&auto=format&q=80`;
    }

    return getPlaceholderImageUrl(searchTerm, width, height);
  } catch (error) {
    console.warn(`Unsplash unavailable for "${searchTerm}", using placeholder:`, error);
    return getPlaceholderImageUrl(searchTerm, width, height);
  }
};

export const getPatternImageSources = async (
  keys: string[] = [],
  width: number = 200,
  height: number = 200,
  options?: { bypassCache?: boolean }
): Promise<{ [key: string]: ImageSource }> => {
  const uniqueKeys = Array.from(new Set(keys.map((k) => (k || '').trim()).filter(Boolean)));
  const imageSources: { [key: string]: ImageSource } = {};
  const bypassCache = options?.bypassCache ?? false;

  for (let index = 0; index < uniqueKeys.length; index += 1) {
    const key = uniqueKeys[index];

    if (!bypassCache && isValidCachedSource(termToImageCache[key])) {
      imageSources[key] = termToImageCache[key];
      continue;
    }

    if (index > 0) {
      await sleep(BETWEEN_REQUEST_DELAY_MS);
    }

    const url = await getUnsplashImageUrl(key, width, height);
    const source = buildImageSource(key, url);
    imageSources[key] = source;

    if (url) {
      termToImageCache[key] = source;
    } else {
      delete termToImageCache[key];
    }
  }

  return imageSources;
};

export const getImageSource = async (
  key: string,
  width: number = 200,
  height: number = 200,
  options?: { bypassCache?: boolean }
): Promise<ImageSource> => {
  const trimmed = key.trim();
  if (!trimmed) {
    return buildImageSource(key, '');
  }

  if (!options?.bypassCache && isValidCachedSource(termToImageCache[trimmed])) {
    return termToImageCache[trimmed];
  }

  const sources = await getPatternImageSources([trimmed], width, height, options);
  return sources[trimmed] ?? buildImageSource(trimmed, '');
};
