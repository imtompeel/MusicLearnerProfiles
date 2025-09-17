// Freesound API integration for sound preferences
// Get your API key from: https://freesound.org/apiv2/apply/

interface FreesoundResult {
  id: number;
  name: string;
  description: string;
  url: string;
  previews: {
    'preview-hq-mp3': string;
    'preview-lq-mp3': string;
  };
  tags: string[];
  duration: number;
  filesize: number;
  username: string;
  license: string;
}

interface FreesoundResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FreesoundResult[];
}

class FreesoundService {
  private apiKey: string;
  private baseUrl = 'https://freesound.org/apiv2';

  constructor() {
    // You'll need to get your API key from Freesound and add it here
    // For now, using a placeholder - replace with your actual API key
    this.apiKey = import.meta.env.VITE_FREESOUND_API_KEY || 'YOUR_FREESOUND_API_KEY';
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}): Promise<FreesoundResponse> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add API key
    url.searchParams.append('token', this.apiKey);
    
    // Add other parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Freesound API error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Freesound API request failed:', error);
      throw error;
    }
  }

  // Search for sounds by category and keywords
  async searchSounds(
    query: string,
    category?: string,
    limit: number = 20,
    antiTerms?: string[],
    maxDuration: number = 10,
    minDuration: number = 1.5,
    filterExtras?: string
  ): Promise<FreesoundResult[]> {
    // Build the search query with optional anti-terms
    let searchQuery = category ? `${query} ${category}` : query;
    
    if (antiTerms && antiTerms.length > 0) {
      searchQuery += ' ' + antiTerms.map(term => `-${term}`).join(' ');
    }
    
    const baseFilter = `duration:[${minDuration} TO ${maxDuration}]`;
    const combinedFilter = filterExtras ? `${baseFilter} ${filterExtras}` : baseFilter;

    const params: Record<string, string> = {
      query: searchQuery,
      fields: 'id,name,description,url,previews,tags,duration,filesize,username,license',
      page_size: limit.toString(),
      // Prefer highly rated sounds for better correctness
      sort: 'rating_desc',
      filter: combinedFilter, // Filter for duration and any extra filters
    };

    console.log(`Searching Freesound with query: "${searchQuery}" (duration: ${minDuration}-${maxDuration}s)`);
    const response = await this.makeRequest('/search/text/', params);
    console.log(`Found ${response.results.length} results for "${searchQuery}"`);
    
    return response.results;
  }

  // Post-filter results: strict on excludeTags, flexible on includeTags
  // - Exclude: candidate must have NONE of excludeTags
  // - Include: require primary tag (if provided) and at least `minInclude` of includeTags overall
  private filterByTags(
    results: FreesoundResult[],
    includeTags: string[],
    excludeTags: string[],
    options?: { primaryTag?: string; minInclude?: number; antiTerms?: string[] }
  ): FreesoundResult[] {
    const include = includeTags.map(t => t.toLowerCase());
    const exclude = excludeTags.map(t => t.toLowerCase());
    const anti = (options?.antiTerms || []).map(t => t.toLowerCase());
    const primary = options?.primaryTag?.toLowerCase().trim();
    const minInclude = Math.max(0, options?.minInclude ?? Math.min(2, include.length || 0));

    return results.filter(r => {
      const tags = (r.tags || []).map(t => t.toLowerCase());
      const name = (r.name || '').toLowerCase();
      // strict: no excluded tags or anti terms in either tags or name
      const hasForbidden = exclude.some(t => tags.includes(t) || name.includes(t))
        || anti.some(t => tags.includes(t) || name.includes(t));
      if (hasForbidden) return false;

      if (include.length === 0) return true;

      // primary must match if provided
      if (primary && !(tags.includes(primary) || name.includes(primary))) return false;

      const includeMatchCount = include.reduce((acc, t) => acc + (tags.includes(t) ? 1 : 0), 0);
      return includeMatchCount >= (primary ? Math.max(1, minInclude) : Math.max(1, minInclude));
    });
  }

  // Strict search: use tag-based filtering plus anti-terms; prefer rating
  async searchSoundsStrict(query: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    category?: string;
    limit?: number;
    maxDuration?: number;
    minDuration?: number;
    antiTerms?: string[];
    categoryFilter?: string; // Freesound Broad Taxonomy top-level category
    subcategoryFilter?: string; // Broad Taxonomy second-level
  }): Promise<FreesoundResult[]> {
    const {
      includeTags = [],
      excludeTags = [],
      category,
      limit = 20,
      maxDuration = 10,
      minDuration = 0.5,
      antiTerms = []
    } = options || {};

    // Use only the include/exclude tags provided by the caller (component/question)
    const finalInclude = Array.from(new Set(includeTags));
    const finalExclude = Array.from(new Set(excludeTags));

    // Reintroduce global anti-terms to avoid common mismatches
    const extraAnti: string[] = [
      'loop', 'remix',
    ];
    const finalAnti = Array.from(new Set([...antiTerms, ...finalExclude, ...extraAnti]));

    // Bias query with include tags to improve relevance
    const biasedQuery = [query, ...finalInclude].join(' ').trim();

    // First attempt with biased query
    const filterExtrasParts: string[] = [];
    if (options?.categoryFilter) filterExtrasParts.push(`category:"${options.categoryFilter}"`);
    if (options?.subcategoryFilter) filterExtrasParts.push(`subcategory:"${options.subcategoryFilter}"`);
    const filterExtras = filterExtrasParts.join(' ');

    let raw = await this.searchSounds(biasedQuery, category, limit, finalAnti, maxDuration, minDuration, filterExtras || undefined);
    let filtered = this.filterByTags(raw, finalInclude, finalExclude, { primaryTag: finalInclude[0], minInclude: 2, antiTerms: finalAnti });

    if (filtered.length > 0) return filtered;

    // Second attempt: try only include tags if
    if (finalInclude.length > 0) {
      const includeOnlyQuery = finalInclude.join(' ');
      raw = await this.searchSounds(includeOnlyQuery, category, limit, finalAnti, maxDuration, minDuration, filterExtras || undefined);
      filtered = this.filterByTags(raw, finalInclude, finalExclude, { primaryTag: finalInclude[0], minInclude: 1, antiTerms: finalAnti });
      if (filtered.length > 0) return filtered;
      // If still nothing and include tags exist, return empty to avoid unrelated picks
      return [];
    }

    // No include tags: return raw as last resort
    return raw;
  }

  // Helper: pick the best single sound for a given instrument/label
  async getBestSoundForLabel(label: string, options?: {
    includeTags?: string[];
    excludeTags?: string[];
    maxDuration?: number;
    minDuration?: number;
  }): Promise<FreesoundResult | null> {
    const results = await this.searchSoundsStrict(label, {
      includeTags: options?.includeTags,
      excludeTags: options?.excludeTags,
      limit: 10,
      maxDuration: options?.maxDuration ?? 8,
      minDuration: options?.minDuration ?? 0.5,
    });
    return results[0] ?? null;
  }

  // Helper method to add delay between requests
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get sounds based on custom search terms (for preference questions - one sound per term)
  async getSoundsByTerms(searchTerms: string[], category?: string, antiTerms?: string[], maxDuration: number = 10, minDuration: number = 1.5): Promise<FreesoundResult[]> {
    const allResults: FreesoundResult[] = [];
    
    // Process queries sequentially with delays to avoid rate limiting
    for (let i = 0; i < searchTerms.length; i++) {
      const query = searchTerms[i];
      try {
        // Get more results per query to increase diversity
        const results = await this.searchSounds(query, category, 50, antiTerms, maxDuration, minDuration);
        console.log(`Search query "${query}" returned ${results.length} results:`, results.map(r => r.name));
        if (results.length > 0) {
          allResults.push(...results);
        }
        
        // Add delay between requests (except for the last one)
        if (i < searchTerms.length - 1) {
          await this.delay(800); // Reduced delay for faster searching
        }
      } catch (error) {
        console.warn(`Failed to fetch sounds for query: ${query}`, error);
        // Add delay even on error to respect rate limits
        if (i < searchTerms.length - 1) {
          await this.delay(800);
        }
      }
    }

    console.log(`Total results collected: ${allResults.length}`);
    return allResults; // Return all sounds found
  }

  // Get one sound per search term (for preference questions)
  async getOneSoundPerTerm(searchTerms: string[], category?: string, antiTerms?: string[], maxDuration: number = 10, minDuration: number = 1.5): Promise<FreesoundResult[]> {
    const results: FreesoundResult[] = [];
    
    // Process queries sequentially with delays to avoid rate limiting
    for (let i = 0; i < searchTerms.length; i++) {
      const query = searchTerms[i];
      try {
        // Get 5 results to choose from for each term
        const searchResults = await this.searchSounds(query, category, 5, antiTerms, maxDuration, minDuration);
        console.log(`Search query "${query}" returned:`, searchResults.map(r => r.name));
        if (searchResults.length > 0) {
          // Randomly select from the available results
          const randomIndex = Math.floor(Math.random() * searchResults.length);
          const selectedSound = searchResults[randomIndex];
          
          console.log(`Randomly selected sound for "${query}": "${selectedSound.name}" (index ${randomIndex})`);
          results.push(selectedSound);
        }
        
        // Add delay between requests (except for the last one)
        if (i < searchTerms.length - 1) {
          await this.delay(1000); // 1 second delay
        }
      } catch (error) {
        console.warn(`Failed to fetch sounds for query: ${query}`, error);
        // Add delay even on error to respect rate limits
        if (i < searchTerms.length - 1) {
          await this.delay(1000);
        }
      }
    }

    return results; // Return one sound per search term
  }

  // Get a single sound by ID
  async getSoundById(id: number): Promise<FreesoundResult> {
    const response = await this.makeRequest(`/sounds/${id}/`, {
      fields: 'id,name,description,url,previews,tags,duration,filesize,username,license'
    });
    return response as unknown as FreesoundResult;
  }

  // Play a sound from Freesound with configurable fade-in
  async playSound(sound: FreesoundResult, options?: { fadeInMs?: number }): Promise<HTMLAudioElement> {
    try {
      // Debug: Log the sound object to see what preview URLs are available
      console.log('Playing sound:', sound.name);
      console.log('Available previews:', sound.previews);
      
      // Get the best available preview URL
      const previewUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
      
      if (!previewUrl) {
        console.error('No preview URL available for sound:', sound.name);
        throw new Error('No preview URL available for this sound');
      }

      console.log('Using preview URL:', previewUrl);

      // Create audio element with proper error handling
      const audio = new Audio();
      
      // Set up error handling
      audio.onerror = (e) => {
        console.error('Audio loading error:', e);
        console.error('Failed URL:', previewUrl);
        throw new Error('Failed to load audio from Freesound');
      };
      
      // Set the source and load
      audio.src = previewUrl;
      audio.load();
      
      // Wait for the audio to be ready
      await new Promise<void>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout;
        
        const cleanup = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };
        
        audio.oncanplaythrough = () => {
          console.log('Audio ready to play:', sound.name);
          cleanup();
          resolve();
        };
        
        audio.onerror = (e) => {
          console.error('Audio error during loading:', e);
          cleanup();
          reject(new Error('Failed to load audio'));
        };
        
        // Timeout after 10 seconds
        timeoutId = setTimeout(() => {
          console.error('Audio loading timeout for:', sound.name);
          reject(new Error('Audio loading timeout'));
        }, 10000);
      });
      
      const fadeInDuration = typeof options?.fadeInMs === 'number' ? options.fadeInMs : 500;
      
      if (fadeInDuration <= 0) {
        // No fade: play at full volume immediately
        audio.volume = 1;
        console.log('Playing audio without fade-in:', sound.name);
        await audio.play();
      } else {
        // Start with volume at 0 for fade-in
        audio.volume = 0;
        
        // Play the audio
        console.log('Playing audio with fade-in:', sound.name);
        await audio.play();
        
        // Fade in over configured duration
        const fadeInSteps = 20;
        const stepDuration = fadeInDuration / fadeInSteps;
        const volumeStep = 1 / fadeInSteps;
        
        for (let i = 0; i <= fadeInSteps; i++) {
          setTimeout(() => {
            audio.volume = Math.min(i * volumeStep, 1);
          }, i * stepDuration);
        }
      }
      
      // Return the audio element for tracking
      return audio;
      
    } catch (error) {
      console.error('Failed to play Freesound audio:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const freesoundService = new FreesoundService();

// Export types for use in components
export type { FreesoundResult, FreesoundResponse };
