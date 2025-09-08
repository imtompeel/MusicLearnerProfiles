# Pattern Matching Images

This directory was originally intended for local image files, but the system now uses an API-based approach for better reliability and maintenance.

## Current Implementation:

The pattern matching questions now use **Unsplash Source API** to generate relevant, high-quality images dynamically. This approach:

- ✅ **No local files required** - Images are fetched from the API
- ✅ **Always available** - No missing image files
- ✅ **Relevant content** - Images actually match the search terms
- ✅ **High quality** - Professional stock photos from Unsplash
- ✅ **Automatic fallback** - Emojis if API fails
- ✅ **Easy maintenance** - No need to manage image assets

## Image Sources:

### Question 2 - Animal Sounds:
- `dog` → Unsplash "dog" search + 🐕 fallback
- `cat` → Unsplash "cat" search + 🐱 fallback  
- `bird` → Unsplash "bird" search + 🐦 fallback
- `cow` → Unsplash "cow" search + 🐄 fallback

### Question 3 - Rhythm Patterns:
- `clock` → Unsplash "clock" search + 🕐 fallback
- `heart` → Unsplash "heart" search + ❤️ fallback
- `drum` → Unsplash "drum" search + 🥁 fallback
- `rain` → Unsplash "rain" search + 🌧️ fallback

## Technical Details:

- **API**: `https://api.unsplash.com/search/photos?query={keyword}&per_page=1&orientation=squarish&client_id={access_key}`
- **Size**: 200x200 pixels (dynamically resized)
- **Search**: Actual relevant images based on keywords using 2025 API standard
- **Fallback**: Placeholder images with text if API fails, emoji fallbacks if image fails to load
- **Implementation**: See `/src/utils/images.ts`

## Benefits:

- **Perfect Matching**: Images now actually match the sound search terms
- **Educational Value**: Students see real photos of dogs, cats, clocks, etc.
- **2025 API Standard**: Uses current Unsplash API with proper authentication
- **Reliable**: High uptime and fast loading with proper error handling
- **Fallback System**: Multiple layers of fallbacks ensure images always load
