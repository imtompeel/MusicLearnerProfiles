# Firebase Setup Guide

## 🚀 **Firebase Configuration**

To use the Firestore-based session management, you need to set up a Firebase project and configure the app.

### **Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name (e.g., "music-learner-profiles")
4. Enable Google Analytics (optional)
5. Click "Create project"

### **Step 2: Enable Firestore**

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your users)
5. Click "Done"

### **Step 3: Get Configuration**

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" → Web app (</> icon)
4. Enter app nickname (e.g., "music-learner-profiles-web")
5. Click "Register app"
6. Copy the configuration object

### **Step 4: Set Up Environment Variables**

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values with your actual Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-actual-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=your-actual-app-id
   ```

3. The app will automatically use these environment variables (no need to edit `src/config/firebase.ts`)

### **Step 5: Firestore Security Rules**

Update your Firestore security rules to allow read/write access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to sessions
    match /sessions/{sessionCode} {
      allow read, write: if true; // For development - restrict in production
    }
  }
}
```

**⚠️ Security Note:** The above rules allow anyone to read/write sessions. For production, implement proper authentication and authorization.

### **Step 6: Deploy to Firebase Hosting**

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init`
   - Select "Hosting"
   - Select your project
   - Set public directory to `dist`
   - Configure as single-page app: `Yes`
   - Overwrite index.html: `No`
4. Build: `npm run build`
5. Deploy: `firebase deploy`

## 🔧 **Features Implemented**

### **Real-time Session Management**
- ✅ Cross-device synchronization
- ✅ Live participant updates
- ✅ Real-time answer submission
- ✅ Session state persistence

### **Privacy & Security**
- ✅ Anonymous sessions (no authentication required)
- ✅ Local name storage (names never uploaded)
- ✅ Session expiration (24 hours)
- ✅ Automatic cleanup

### **Data Export**
- ✅ Teacher can download session results
- ✅ JSON format with all participant data
- ✅ Timestamps and session metadata

## 📱 **Usage**

### **Teacher Interface**
1. Start a session → Gets session code
2. Share session code with students
3. Monitor real-time responses
4. Download results after session

### **Student Interface**
1. Enter name (stored locally)
2. Join with session code
3. Answer questions in real-time
4. Names never leave their device

## 🛠️ **Development vs Production**

### **Development**
- Uses test mode Firestore rules
- All data is publicly accessible
- Good for testing and development

### **Production**
- Implement proper authentication
- Restrict Firestore rules
- Add session validation
- Consider rate limiting

## 🔍 **Troubleshooting**

### **Common Issues**

1. **"Firebase not initialized"**
   - Check your `.env` file exists and has all required variables
   - Ensure all environment variables start with `VITE_`
   - Restart your development server after adding environment variables

2. **"Permission denied"**
   - Check Firestore security rules
   - Ensure rules allow read/write access

3. **"Session not found"**
   - Check if session code is correct
   - Verify session hasn't expired (24 hours)

4. **"Real-time updates not working"**
   - Check browser console for errors
   - Verify Firestore connection
   - Check network connectivity

### **Debug Mode**

Use the "🔍 Debug Session State" button in the teacher interface to:
- View current session state
- Check localStorage data
- Monitor real-time updates

## 📊 **Data Structure**

Sessions are stored in Firestore with this structure:

```
sessions/{sessionCode}/
├── isActive: boolean
├── currentQuestion: object
├── timeRemaining: number
├── currentQuestionIndex: number
├── createdAt: timestamp
├── expiresAt: timestamp
├── participants: {
│   [deviceId]: {
│     name: string (empty - names stored locally)
│     answers: {
│       [questionNumber]: string[]
│     }
│     joinedAt: timestamp
│   }
│ }
└── questions: array
```

## 🎯 **Next Steps**

1. Set up Firebase project
2. Copy `.env.example` to `.env` and add your Firebase configuration
3. Test locally with `npm run dev`
4. Deploy to Firebase Hosting
5. Test cross-device functionality
6. Implement production security rules

## 🔐 **Environment Variables**

The app uses environment variables for Firebase configuration:

- **`.env.example`** - Template file with placeholder values
- **`.env`** - Your actual configuration (not committed to git)
- **`.gitignore`** - Ensures `.env` files are not committed

**Important:** All environment variables must start with `VITE_` to be accessible in the browser.
