# Student Join URL Guide

## How to Access Student Join Interface

The student join interface is now fully modular and accessible via URL parameters. Here's how it works:

### 🎯 **Student Join URLs**

Students can join sessions using URLs in this format:
```
http://localhost:5174/?student=true&code=SESSION_CODE
```

### 📱 **For Teachers**

1. **Start a My Creativity Session**
   - Select your class
   - Choose "My Creativity" session
   - Click "Start Session"
   - A session code will be generated (e.g., "ABC123")

2. **Get Student Join URL**
   - Click the "📋 Copy Student Join URL" button
   - The URL will be copied to your clipboard
   - Share this URL with students

3. **Example URLs**
   - Local development: `http://localhost:5174/?student=true&code=ABC123`
   - Production: `https://yourdomain.com/?student=true&code=ABC123`

### 👥 **For Students**

1. **Join the Session**
   - Open the student join URL on iPad/mobile device
   - Enter your name
   - Click "Join Session"

2. **Participate**
   - Answer questions in real-time
   - See timer countdown
   - View your selected answers

### 🔧 **Technical Details**

#### **Modular Architecture**
- **`AppRouter.tsx`**: Routes between teacher and student interfaces
- **`TeacherInterface.tsx`**: Main teacher interface (default)
- **`StudentJoinPage.tsx`**: Dedicated student join page
- **`routing.ts`**: URL parameter utilities

#### **URL Parameters**
- `student=true`: Enables student mode
- `code=SESSION_CODE`: Session code for joining
- `session=SESSION_NAME`: Optional session type
- `class=CLASS_NAME`: Optional class name

#### **Routing Logic**
```typescript
// Check if in student mode
if (isStudentMode()) {
  return <StudentJoinPage />;
}

// Default to teacher interface
return <TeacherInterface />;
```

### 🌐 **Network Access**

To allow students on different devices to join:

1. **Start with network access:**
   ```bash
   npm run dev -- --host
   ```

2. **Share the network URL:**
   ```
   http://YOUR_IP:5174/?student=true&code=SESSION_CODE
   ```

3. **Find your IP address:**
   ```bash
   # On Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # On Windows
   ipconfig | findstr "IPv4"
   ```

### 📋 **Example Workflow**

1. **Teacher starts session:**
   - Opens `http://localhost:5174/`
   - Selects class and "My Creativity"
   - Clicks "Start Session" → gets code "XYZ789"

2. **Teacher shares URL:**
   - Clicks "Copy Student Join URL"
   - Shares: `http://localhost:5174/?student=true&code=XYZ789`

3. **Students join:**
   - Open URL on iPad/phone
   - Enter name and join
   - Participate in real-time

### 🎨 **Features**

- **Responsive Design**: Works on all device sizes
- **Touch-Friendly**: Optimised for tablets and phones
- **Real-time Updates**: Live question progression
- **Session Management**: Automatic session code generation
- **Error Handling**: Invalid URLs show helpful messages

### 🔒 **Security Notes**

- Session codes are randomly generated
- No authentication required (suitable for classroom use)
- All data stored locally in browser
- No server-side session management

### 🚀 **Future Enhancements**

- WebSocket integration for true real-time communication
- Session persistence across page refreshes
- Advanced participant management
- Custom question creation
- Analytics and reporting

The modular architecture makes it easy to extend and maintain the student join functionality while keeping the code clean and organised!
