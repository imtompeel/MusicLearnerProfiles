# Freesound API Setup Instructions

## Getting Your API Key

1. Go to [Freesound API](https://freesound.org/apiv2/apply/)
2. Create an account or log in
3. Apply for an API key
4. Once approved, you'll receive your API key

## Environment Configuration

Create a `.env` file in your project root with:

```env
# Freesound API Configuration
VITE_FREESOUND_API_KEY=your_actual_api_key_here
```

## How It Works

The Freesound integration provides:

### **Nature Sounds**
- Ocean waves
- Forest birds
- Rain and thunder
- Wind through trees
- River streams
- Bird songs
- Cricket sounds
- Fire crackling

### **Music Sounds**
- Piano classical
- Acoustic guitar
- Violin strings
- Saxophone jazz
- Rock drums
- Flute melodies
- Trumpet brass
- Church organ

### **Home Sounds**
- Kitchen cooking
- Door opening
- Footsteps
- Clock ticking
- Vacuum cleaner
- Washing machine
- Coffee brewing
- Book pages

## Usage in Questions

To use Freesound in your questions, set the question type to `'freesound'` and include keywords in the question text:

- **Nature**: Include "nature" or "outdoor" in question text
- **Music**: Include "music" or "instrument" in question text  
- **Home**: Include "home" or "indoor" in question text

Example question:
```json
{
  "question_type": "freesound",
  "question_text": "Which nature sound do you prefer?",
  "question_number": "1"
}
```

## Features

- ✅ Automatic sound categorization
- ✅ High-quality audio previews
- ✅ Sound descriptions and metadata
- ✅ Loading states and error handling
- ✅ Fallback to musical notes if sounds fail
- ✅ Auto-advance after selection

## Troubleshooting

If sounds don't load:
1. Check your API key is correct
2. Ensure you have internet connection
3. Check browser console for errors
4. Verify Freesound API quota limits

The app will gracefully fall back to musical notes if Freesound is unavailable.
