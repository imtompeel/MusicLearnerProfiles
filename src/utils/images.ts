// Image utility functions for pattern matching questions

export interface ImageSource {
  url: string;
  alt: string;
  fallback: string; // emoji fallback
}

// Unsplash API for relevant images - 2025 API Standard
export const getUnsplashImageUrl = async (searchTerm: string, width: number = 200, height: number = 200): Promise<string> => {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  
  if (!accessKey || accessKey === 'your_unsplash_access_key_here') {
    // Fallback to a placeholder service if no API key
    return `https://via.placeholder.com/${width}x${height}/667eea/ffffff?text=${encodeURIComponent(searchTerm)}`;
  }
  
  try {
    const encodedTerm = encodeURIComponent(searchTerm);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedTerm}&per_page=5&orientation=squarish&client_id=${accessKey}`,
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
      // Randomly select from available results
      const randomIndex = Math.floor(Math.random() * data.results.length);
      const selectedImage = data.results[randomIndex];
      const imageUrl = selectedImage.urls.small;
      console.log(`Randomly selected image for "${searchTerm}": index ${randomIndex} of ${data.results.length} results`);
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

// Get image sources for pattern matching questions
export const getPatternImageSources = async (): Promise<{ [key: string]: ImageSource }> => {
  const imageSources: { [key: string]: ImageSource } = {};
  
  const terms = ['dog', 'cat', 'bird', 'cow', 'clock', 'heart', 'drum', 'rain'];
  const fallbacks = ['🐕', '🐱', '🐦', '🐄', '🕐', '❤️', '🥁', '🌧️'];
  
  // Fetch all images in parallel
  const imagePromises = terms.map(async (term, index) => {
    const url = await getUnsplashImageUrl(term, 200, 200);
    return {
      term,
      url,
      fallback: fallbacks[index]
    };
  });
  
  const results = await Promise.all(imagePromises);
  
  results.forEach(({ term, url, fallback }) => {
    imageSources[term] = {
      url,
      alt: term.charAt(0).toUpperCase() + term.slice(1),
      fallback
    };
  });
  
  return imageSources;
};

// Get a specific image source by key
export const getImageSource = async (key: string): Promise<ImageSource> => {
  const sources = await getPatternImageSources();
  return sources[key] || {
    url: await getUnsplashImageUrl(key, 200, 200),
    alt: key,
    fallback: '🖼️'
  };
};
