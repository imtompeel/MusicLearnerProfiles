// Image utility functions for pattern matching questions

export interface ImageSource {
  url: string;
  alt: string;
  fallback: string; // emoji fallback
}

// Unsplash API for relevant images - 2025 API Standard
// Query overrides to reduce ambiguity in results (e.g., flute vs trumpet, vacuum vs record player)
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
  cow: 'cow animal icon'
};

export const getUnsplashImageUrl = async (searchTerm: string, width: number = 200, height: number = 200): Promise<string> => {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  
  if (!accessKey || accessKey === 'your_unsplash_access_key_here') {
    // Fallback to a placeholder service if no API key
    return `https://via.placeholder.com/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(searchTerm)}`;
  }
  
  try {
    const override = termQueryOverrides[searchTerm.toLowerCase()];
    const query = override || searchTerm;
    const encodedTerm = encodeURIComponent(query);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedTerm}&per_page=3&content_filter=high&order_by=relevant&orientation=squarish&client_id=${accessKey}`,
      {
        headers: {
          'Accept-Version': 'v1'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Use the first, most relevant result for determinism
      const selectedImage = data.results[0];
      const imageUrl = selectedImage.urls.small;
      return `${imageUrl}&w=${width}&h=${height}&fit=crop`;
    }
    
    // Fallback if no results
    return `https://via.placeholder.com/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(searchTerm)}`;
  } catch (error) {
    console.error('Failed to fetch Unsplash image:', error);
    // Fallback to placeholder
    return `https://via.placeholder.com/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(searchTerm)}`;
  }
};

// Simple in-memory cache to avoid refetching the same terms
const termToImageCache: { [key: string]: ImageSource } = {};

// Reasonable default emoji fallbacks for common terms; anything else uses a generic frame
const defaultEmojiFallbacks: { [key: string]: string } = {
  dog: '🐕',
  cat: '🐱',
  bird: '🐦',
  cow: '🐄',
  clock: '🕐',
  heart: '❤️',
  drum: '🥁',
  rain: '🌧️'
};

// Get image sources for pattern matching questions, based on provided keys
export const getPatternImageSources = async (
  keys: string[] = [],
  width: number = 200,
  height: number = 200
): Promise<{ [key: string]: ImageSource }> => {
  const uniqueKeys = Array.from(new Set(keys.map(k => (k || '').trim()).filter(Boolean)));
  const imageSources: { [key: string]: ImageSource } = {};

  // Build promises for keys not yet cached
  const fetchPromises = uniqueKeys.map(async key => {
    if (termToImageCache[key]) {
      imageSources[key] = termToImageCache[key];
      return;
    }

    const emojiFallback = defaultEmojiFallbacks[key.toLowerCase()] || '🖼️';
    try {
      const url = await getUnsplashImageUrl(key, width, height);
      const source: ImageSource = {
        url,
        alt: key,
        fallback: emojiFallback
      };
      termToImageCache[key] = source;
      imageSources[key] = source;
    } catch {
      const source: ImageSource = {
        url: `https://via.placeholder.com/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(key)}`,
        alt: key,
        fallback: emojiFallback
      };
      termToImageCache[key] = source;
      imageSources[key] = source;
    }
  });

  await Promise.all(fetchPromises);
  return imageSources;
};

// Get a specific image source by key
export const getImageSource = async (key: string): Promise<ImageSource> => {
  if (termToImageCache[key]) return termToImageCache[key];
  const sources = await getPatternImageSources([key]);
  return sources[key];
};
