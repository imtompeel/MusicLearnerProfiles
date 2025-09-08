# Testing Guide for My Creativity Session

## How to Test the Student Join Functionality

### 🧪 **Step-by-Step Testing**

1. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Server will be available at: `http://localhost:5174/`

2. **Open Teacher Interface**
   - Go to: `http://localhost:5174/`
   - Select a class (or create one)
   - Choose "My Creativity" session
   - Click "Start Session"
   - Note the session code (e.g., "ABC123")

3. **Copy Student Join URL**
   - Click "📋 Copy Student Join URL" button
   - This copies: `http://localhost:5174/?student=true&code=ABC123`

4. **Test Student Interface**
   - Open the copied URL in a new tab/window
   - You should see the student join interface
   - Enter a name and click "Join Session"

5. **Test Question Flow**
   - On teacher interface, click "Next Question" or wait for timer
   - Student interface should show the current question
   - Student can select answers
   - Timer should count down in real-time

### 🔍 **Troubleshooting**

#### **Student sees "Waiting for teacher to start session"**
- Make sure teacher has clicked "Start Session"
- Check that session code matches exactly
- Refresh the student page

#### **Student doesn't see questions**
- Verify teacher has started the session
- Check browser console for errors
- Make sure both tabs are on the same domain

#### **Timer not syncing**
- Check that both interfaces are using the same session code
- Refresh both pages if needed
- Check browser console for JavaScript errors

### 🧪 **Manual Testing Checklist**

- [ ] Teacher can start session
- [ ] Session code is generated
- [ ] Student join URL is copied correctly
- [ ] Student can join with name
- [ ] Questions appear on student interface
- [ ] Timer counts down on both interfaces
- [ ] Student can select multiple answers
- [ ] Teacher can see student responses
- [ ] Next question works correctly
- [ ] Session can be ended properly

### 🐛 **Debug Information**

#### **Check Session State**
Open browser console and run:
```javascript
// Check current session state
console.log(sessionManager.getState());
```

#### **Check URL Parameters**
```javascript
// Check URL parameters
console.log(new URLSearchParams(window.location.search));
```

#### **Check Network Requests**
- Open Developer Tools → Network tab
- Look for any failed requests
- Check for CORS errors

### 📱 **Mobile Testing**

1. **Start with network access:**
   ```bash
   npm run dev -- --host
   ```

2. **Find your IP address:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

3. **Test on mobile device:**
   - Connect to same WiFi network
   - Open: `http://YOUR_IP:5174/?student=true&code=SESSION_CODE`
   - Test touch interactions

### 🎯 **Expected Behavior**

#### **Teacher Interface**
- Shows session code prominently
- Displays participant count
- Shows current question and timer
- Updates in real-time

#### **Student Interface**
- Shows session code
- Allows name entry
- Displays current question
- Shows timer countdown
- Allows answer selection
- Updates when teacher advances

### 🔧 **Common Issues & Solutions**

#### **"No questions available"**
- Check that class level has questions in `creativityQuestions.ts`
- Verify class SoI level matches question class levels

#### **Session not starting**
- Check browser console for errors
- Verify all components are imported correctly
- Check that sessionManager is working

#### **Student can't join**
- Verify URL format: `?student=true&code=SESSION_CODE`
- Check that session code is correct
- Make sure teacher has started session

### 📊 **Performance Testing**

- Test with multiple student tabs open
- Check memory usage in browser dev tools
- Verify timer accuracy
- Test on slower devices

The modular architecture should make debugging easier - each component has a clear responsibility and the shared state system provides a single source of truth for session data.
