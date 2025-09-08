# Music Learner Profiles - React App

A modern React application for collecting and managing student music preferences and profiles. This application was converted from a large HTML file into a modular Vite React TypeScript application.

## Features

- **Teacher Controls**: Manage classes, download data, clear all data, and view summaries
- **Class Management**: Create, edit, and delete classes with different SoI (Structure of Intellect) levels
- **Student Name Entry**: Interactive keyboard for students to enter their names with musical feedback
- **Preference Collection**: Dynamic questions based on class level and session type
- **Spotify Integration**: Search for artists and songs with preview functionality
- **Audio Feedback**: Musical notes and sound effects for enhanced user experience
- **Data Export**: Download student data as CSV files
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Custom Hooks** for state management
- **Local Storage** for data persistence
- **Spotify Web API** for music search
- **Web Audio API** for sound generation

## Project Structure

```
src/
├── components/          # React components
│   ├── TeacherControls.tsx
│   ├── ClassSelection.tsx
│   ├── StudentSection.tsx
│   ├── NameEntry.tsx
│   ├── Preferences.tsx
│   └── Status.tsx
├── hooks/              # Custom React hooks
│   ├── useAudio.ts
│   ├── useClasses.ts
│   ├── useSpotify.ts
│   ├── useStatus.ts
│   └── useStudentData.ts
├── utils/              # Utility functions
│   ├── audio.ts
│   ├── csv.ts
│   ├── spotify.ts
│   └── storage.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── data/               # Static data
│   ├── musicQuestions.ts
│   └── defaultClasses.ts
└── styles/             # CSS styles
    └── App.css
```

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

Build the application:
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Usage

1. **Select a Class**: Choose from existing classes or create new ones
2. **Select a Session**: Choose "Music Who Are You?" session
3. **Student Name Entry**: Students use the on-screen keyboard to enter their names
4. **Preference Collection**: Students answer questions based on their class level
5. **Data Management**: Teachers can download data, clear all data, or view summaries

## Class Levels (SoI)

- **R1.1**: Sound Awareness
- **R2.1**: Pattern Recognition  
- **R3.1**: Musical Phrases
- **R4.1**: Musical Motifs
- **R5.1**: Complete Pieces
- **R6**: Cultural Understanding

## Spotify Integration

The application integrates with Spotify's Web API to:
- Search for artists
- Search for songs
- Get artist top tracks
- Play audio previews (when available)

## Audio Features

- Musical note generation for keyboard interactions
- Sound file playback for preference questions
- Audio feedback for user actions
- Name-to-music conversion

## Data Storage

- Student data is stored in browser's local storage
- Class configurations are persisted locally
- Data can be exported as CSV files
- All data can be cleared by teachers

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the MusicLearnerProfiles educational system.