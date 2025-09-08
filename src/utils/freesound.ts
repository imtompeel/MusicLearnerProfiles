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
  async searchSounds(query: string, category?: string, limit: number = 20, antiTerms?: string[], maxDuration: number = 10, minDuration: number = 1.5): Promise<FreesoundResult[]> {
    // Build the search query with optional anti-terms
    let searchQuery = category ? `${query} ${category}` : query;
    
    if (antiTerms && antiTerms.length > 0) {
      searchQuery += ' ' + antiTerms.map(term => `-${term}`).join(' ');
    }
    
    const params: Record<string, string> = {
      query: searchQuery,
      fields: 'id,name,description,url,previews,tags,duration,filesize,username,license',
      page_size: limit.toString(),
      sort: 'score', // Sort by relevance score instead of rating
      filter: `duration:[${minDuration} TO ${maxDuration}]`, // Filter for sounds within duration range
    };

    console.log(`Searching Freesound with query: "${searchQuery}" (duration: ${minDuration}-${maxDuration}s)`);
    const response = await this.makeRequest('/search/text/', params);
    console.log(`Found ${response.results.length} results for "${searchQuery}"`);
    
    return response.results;
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

  // Play a sound from Freesound with fade-in
  async playSound(sound: FreesoundResult): Promise<HTMLAudioElement> {
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
      
      // Start with volume at 0 for fade-in
      audio.volume = 0;
      
      // Play the audio
      console.log('Playing audio with fade-in:', sound.name);
      await audio.play();
      
      // Fade in over 0.5 seconds
      const fadeInDuration = 500; // milliseconds
      const fadeInSteps = 20;
      const stepDuration = fadeInDuration / fadeInSteps;
      const volumeStep = 1 / fadeInSteps;
      
      for (let i = 0; i <= fadeInSteps; i++) {
        setTimeout(() => {
          audio.volume = Math.min(i * volumeStep, 1);
        }, i * stepDuration);
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
