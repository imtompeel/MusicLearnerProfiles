# Freesound API Key Application Guide

## Step 1: Log In and Apply for API Access

1. Go to [https://freesound.org/apiv2/apply](https://freesound.org/apiv2/apply)
2. Log in with your existing Freesound account
3. Click **"Apply for API access"** or similar button

## Step 2: Fill Out the API Application Form

### **Application Details:**

**Application Name:**
```
MusicLearnerProfiles - SEND Sound Preferences & SoI Framework
```

**Application Description:**
```
An educational web application specifically designed for SEND (Special Educational Needs and Disabilities) learners to express their sound preferences using the Sounds of Intent (SoI) framework. The application helps teachers and music therapists understand how SEND students respond to different types of sounds across nature, music, and home environments. This supports the SoI framework's approach to assessing musical development in learners with complex needs, enabling more effective and personalized music education interventions.
```

**Application URL:**
```
https://your-domain.com (or localhost:3000 for development)
```

**Application Type:**
```
Web Application
```

**Intended Use:**
```
SEND Education, Music Therapy, and Sounds of Intent Framework Assessment
```

### **Technical Details:**

**API Usage Description:**
```
The application will:
1. Search for and retrieve high-quality sound samples from Freesound
2. Categorize sounds into nature, music, and home environment categories aligned with SoI framework levels (R1.1-R6)
3. Present sound samples to SEND learners for preference selection and response assessment
4. Record learner responses to support SoI framework evaluation and musical development tracking
5. Generate reports for teachers, music therapists, and SEND coordinators
6. Support evidence-based music education interventions for learners with complex needs

Expected usage: ~100-500 API calls per day during active SEND learning sessions and music therapy interventions.
```

**Sound Categories Needed (Aligned with SoI Framework):**
- **Nature Sounds**: Ocean waves, forest birds, rain, wind, rivers, bird songs, crickets, fire
- **Music Sounds**: Piano, guitar, violin, saxophone, drums, flute, trumpet, organ
- **Home Sounds**: Kitchen cooking, doors, footsteps, clocks, vacuum, washing machine, coffee, books

**SoI Framework Integration:**
- **R1.1 (Sound Awareness)**: Basic environmental and musical sounds
- **R2.1 (Pattern Recognition)**: Rhythmic and melodic patterns
- **R3.1 (Musical Phrases)**: Short musical sequences
- **R4.1 (Musical Motifs)**: Recognizable musical themes
- **R5.1 (Complete Pieces)**: Full musical compositions
- **R6 (Cultural Understanding)**: Culturally significant sounds and music

**Data Storage:**
```
SEND learner preferences and SoI framework assessments will be stored locally and exported as CSV files for teachers, music therapists, and SEND coordinators. No personal audio content will be stored - only preference selections, response data, and SoI level assessments for educational planning and intervention tracking.
```

### **Compliance Information:**

**Terms of Service Agreement:**
```
I agree to comply with Freesound's terms of service and will:
- Use sounds only for the stated educational purpose
- Provide proper attribution when required
- Not redistribute or resell the audio content
- Respect Creative Commons licensing requirements
- Use the API responsibly and within rate limits
```

**Attribution Plan:**
```
All sounds used will be properly attributed to their creators through the Freesound API metadata. SEND learner assessment reports will include sound creator information where applicable, supporting transparency in educational and therapeutic interventions.
```

## Step 3: Submit and Wait for Approval

1. Review all information carefully
2. Submit the application
3. Check your email for confirmation
4. Wait for approval (usually 1-3 business days)

## Step 4: After Approval

Once approved, you'll receive your API key via email. Then:

1. Create a `.env` file in your project root:
```env
VITE_FREESOUND_API_KEY=your_actual_api_key_here
```

2. Restart your development server to load the new environment variable

3. Test the integration by running your app

## Important Notes

### **Rate Limits:**
- Free tier: 200 requests per day
- Be mindful of usage to stay within limits
- Consider caching results when possible

### **Attribution Requirements:**
- Always include sound creator information
- Respect Creative Commons licenses
- Provide proper attribution in your application

### **Best Practices:**
- Use high-quality preview URLs when available
- Implement error handling for failed requests
- Cache frequently used sounds
- Provide fallback options if API is unavailable

## Troubleshooting

### **If Application is Rejected:**
- Provide more detailed information about your educational use case
- Clarify how you'll handle attribution
- Explain your data storage and privacy practices
- Consider applying with a more specific educational institution affiliation

### **If API Key Doesn't Work:**
- Verify the key is correctly set in your `.env` file
- Check that the environment variable name matches: `VITE_FREESOUND_API_KEY`
- Restart your development server after adding the key
- Check the browser console for any error messages

## Support

- **Freesound Documentation**: [https://freesound.org/docs/api/](https://freesound.org/docs/api/)
- **Freesound Forum**: [https://freesound.org/forum/](https://freesound.org/forum/)
- **Contact**: Use the Freesound contact form for API-specific issues

---

**Good luck with your application!** 🎵
