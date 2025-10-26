# DeutschBoost 🚀

A personalized German language learning platform powered by AI. Learn German through adaptive lessons, AI conversations with memory, and interactive activities tailored to your proficiency level.

> **New!** AI Conversation Partner now remembers your progress and provides personalized learning based on your previous sessions!

## 🎉 What's New (Latest Updates)

### Recent Improvements (2025)
- ✅ **Fixed Activity Completion System**: Learning plan items now use database IDs for accurate completion tracking - no more wrong activities being marked complete!
- ✅ **Reading in German**: Reading comprehension questions and answer choices now in German for authentic practice
- ✅ **Speaking Practice Overhaul**: Dedicated speaking activity page with real-time AI audio, automatic scoring, and learning plan integration
- ✅ **Enhanced Placement Test**: 3-section comprehensive assessment (Reading + Grammar + Writing) for more accurate level evaluation
- ✅ **Study Streak Tracking**: Track consecutive study days and total study time across all activities

### Conversation History & AI Context Awareness
- ✅ **Session Memory**: Every conversation is saved with complete transcripts and AI feedback
- ✅ **Smart History View**: Browse past conversations with expandable cards showing scores, feedback, and full transcripts
- ✅ **Context-Aware AI**: Alex loads your last session's feedback and adapts the conversation to your needs
- ✅ **Continuous Learning**: AI remembers your grammar mistakes, vocabulary gaps, and strengths across sessions
- ✅ **Multilingual Feedback**: All feedback provided in your native language for better understanding
- ✅ **Beautiful UI**: Polished conversation history cards with color-coded scores and detailed analytics

## ✨ Features

### 🎯 Smart Placement Test
- Comprehensive CEFR-based assessment (A1-C2)
- Evaluates grammar, vocabulary, reading comprehension, and listening skills
- Identifies strengths and weaknesses
- Provides personalized recommendations

### 📚 AI-Powered Learning Plans
- Customized weekly learning schedules based on your level
- Structured progression from your current level to target goals
- Covers all essential skills: Grammar, Vocabulary, Listening, Writing, Speaking
- Automatic progress tracking and completion status

### 🎮 Interactive Learning Activities
Six types of AI-generated activities, all fully working:

1. **Grammar Exercises**: Fill-in-the-blank questions with detailed explanations in your native language
2. **Vocabulary Practice**: Flashcard-style matching and translation exercises
3. **Reading Comprehension**: German texts with questions and answer choices in German (authentic exam-style practice)
4. **Listening Comprehension**: Audio-based exercises with comprehension questions
5. **Writing Tasks**: AI-evaluated writing with feedback on grammar, vocabulary, and fluency
6. **Speaking Practice**: Real-time AI conversation partner with topic-specific guidance from your learning plan

**Integrated Learning Plan Activities:**
- Each week's learning plan includes specific activities across all six skill areas
- Activities are dynamically generated based on your CEFR level
- Automatic completion tracking when you achieve 70%+ score
- Progress syncs with study streak and total study time

### 💬 AI Conversation Partner (with Memory!)
**Real-time voice conversations with Alex, your AI German tutor:**
- 🎙️ **Natural Voice Conversations**: Speak and listen with Google Gemini Live AI
- 🧠 **Context Awareness**: Alex remembers your previous conversations and builds on them
- 📊 **Detailed Feedback**: After each session, receive comprehensive feedback including:
  - Overall performance score (0-100)
  - Strengths and areas for improvement
  - Grammar corrections with explanations
  - Vocabulary suggestions
  - Fluency assessment
  - Personalized encouragement in your native language
- 📚 **Conversation History**: View all past conversations with expandable details
- 🎯 **Adaptive Learning**: Each conversation uses feedback from previous sessions to focus on your weak areas
- 🌐 **CEFR-Adapted**: Alex adjusts speaking style, vocabulary, and complexity based on your level (A1-C2)
- 🔄 **Continuous Improvement**: AI tracks recurring grammar patterns and suggests vocabulary naturally

### 🎭 Multiple Conversation Modes
Choose from 5 specialized learning modes in the AI Conversation Partner:

1. **Free Conversation** 💬
   - Natural, open-ended conversation practice
   - Alex adapts topics to your interests
   - Perfect for building conversational confidence

2. **Reading Practice** 📖
   - Alex presents German texts appropriate for your level
   - Read aloud and receive pronunciation feedback
   - Patient AI that waits for you to finish before commenting
   - Detailed feedback on articulation and fluency

3. **Vocabulary Builder** 📚
   - Learn 2-3 new words each session
   - Instructions in your native language, German words with examples
   - Practice creating sentences with new vocabulary
   - Immediate corrections and better phrasing suggestions

4. **Grammar Drill** ✏️
   - Interactive error identification exercises
   - Conducted 90% in German for immersion
   - Find mistakes in sentences and explain corrections
   - Multiple examples of the same grammar pattern for reinforcement

5. **Listening Comprehension** 👂
   - Alex tells stories or describes situations
   - Answer comprehension questions verbally
   - Improves listening skills at natural speaking speeds
   - Questions about main ideas, details, and inferences

### 🎤 Integrated Speaking Practice
**Speaking activities from your learning plan with dedicated AI support:**
- Topic-specific conversations based on learning plan items
- AI focuses conversation on the assigned topic (e.g., "Introducing yourself", "Family", "Hobbies")
- Real-time voice interaction with Gemini Live AI
- Automatic evaluation and scoring after session ends
- Auto-completes learning plan item when you score 70%+
- Returns you to learning plan with progress saved
- Study time and streak tracking included

### 📊 Progress Tracking & Analytics
- 📈 **Conversation History**: View all past conversation sessions with scores and detailed feedback
- ✅ **Learning Plan Progress**: Track completion of weekly learning activities with database-backed accuracy
- 🔥 **Study Streak**: Monitor consecutive days of study - streak increments when you study on consecutive days
- ⏱️ **Total Study Time**: Track cumulative study time across all activities (conversations, exercises, reading, etc.)
- 📝 **Study Sessions**: Detailed records of each study session with activity type, duration, and items completed
- 📊 **Performance Metrics**: Detailed analytics on your strengths and improvement areas
- 🎯 **Score Trends**: See your progress over time across multiple conversations
- 🏆 **Achievements**: Celebrate milestones and learning goals
- 💯 **Auto-Completion**: Learning plan items automatically mark complete when you score 70%+ on activities

### 🌍 Multi-Language Support
- Set your native language for better learning experience
- Instructions and explanations in your mother tongue
- Supports English, Arabic, and more

### 🔐 Secure User Management
- Email/password authentication
- Google OAuth integration
- Profile customization with avatar support
- Secure data storage with Supabase

## 🌟 How It Works: AI Conversation with Memory

DeutschBoost's AI Conversation Partner uses advanced context awareness to provide truly personalized learning:

1. **First Conversation**: Alex introduces himself and adapts to your CEFR level
2. **AI Feedback**: After each conversation, you receive detailed analysis with a 0-100 score
3. **Memory System**: Your feedback is saved and loaded before the next conversation
4. **Personalized Learning**: Alex references your previous strengths, addresses recurring mistakes, and naturally incorporates suggested vocabulary
5. **Continuous Improvement**: Watch your scores improve as Alex helps you overcome specific challenges

**Example**: If your last feedback showed issues with dative prepositions, Alex will gently reinforce correct usage in your next conversation without explicitly mentioning it - making learning natural and contextual!

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (via CDN)
- **AI**:
  - Google Gemini 2.5 Flash (activities, assessments)
  - Google Gemini 2.5 Pro (feedback generation, deep thinking)
  - Google Gemini Live (real-time voice conversations)
- **Backend**: Supabase
  - PostgreSQL Database with JSONB for conversation storage
  - Row Level Security (RLS) policies
  - Real-time subscriptions
  - Authentication (Email/Password + Google OAuth)
- **Deployment**: Vercel
- **PWA**: Vite PWA Plugin with Workbox

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Google Gemini API key
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/aliihsaad/DeutschBoost.git
cd DeutschBoost
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following:

```env
# Gemini AI API Key
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key
API_KEY=your_gemini_api_key

# Supabase Configuration
# Get from: https://supabase.com/dashboard/project/_/settings/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
VITE_APP_URL=http://localhost:5173
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🗄️ Database Setup

The app uses Supabase for data storage. To set up the database:

1. Create a new project in [Supabase](https://supabase.com)
2. Run the migration files in order in your Supabase SQL editor:
   - `supabase_migrations/00_diagnostic_and_fix.sql` (creates all tables, RLS policies, and fixes user records)
   - `supabase_migrations/add_mother_language.sql` (adds mother language support)
   - Conversation sessions table is automatically created with JSONB fields for:
     - Transcripts (speaker, text, timestamp)
     - AI-generated feedback (scores, corrections, suggestions)
3. Copy your project URL and anon key to `.env.local`
4. Enable Google OAuth in Supabase Authentication settings (optional)

### Database Schema Highlights

**conversation_sessions table:**
- Stores complete conversation transcripts
- AI feedback as JSONB (flexible schema)
- Duration tracking
- Links to user profiles for RLS
- Enables conversation history and AI context awareness

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Configure environment variables in Vercel project settings
4. Deploy!

Vercel will automatically detect the Vite configuration from `vercel.json`.

## Project Structure

```
DeutschBoost/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (Auth)
│   ├── lib/            # Library configurations (Supabase)
│   ├── pages/          # Auth pages (Login, Signup)
│   └── types/          # TypeScript type definitions
├── components/         # Main components
│   ├── ConversationHistoryCard.tsx  # History display component
│   ├── Card.tsx                     # Reusable card component
│   └── LoadingSpinner.tsx           # Loading state component
├── pages/             # Application pages
│   ├── ConversationPage.tsx       # AI conversation with 5 modes & history
│   ├── SpeakingActivityPage.tsx   # NEW: Dedicated speaking practice
│   ├── ActivityPage.tsx           # Learning plan activity handler
│   ├── LearningPlanPage.tsx       # 4-week learning plan display
│   ├── EnhancedPlacementTestPage.tsx  # 3-section placement test
│   ├── ProfilePage.tsx            # User profile & settings
│   └── HomePage.tsx               # Landing page
├── services/          # API services
│   ├── geminiService.ts           # AI prompts for all 5 conversation modes
│   ├── conversationService.ts     # History & feedback management
│   ├── learningPlanService.ts     # Learning plan & progress tracking
│   └── activityService.ts         # Activity generation (Grammar, Vocab, Reading, etc.)
├── supabase_migrations/  # Database migrations
│   ├── 00_diagnostic_and_fix.sql       # Initial schema setup
│   ├── 001_add_reading_skill.sql       # Add Reading skill support
│   ├── 002_add_mother_language.sql     # Multi-language support
│   └── 003_add_speaking_activity_mode.sql  # Speaking activity mode
└── public/            # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Contact

Created by [aliihsaad](https://github.com/aliihsaad)

Project Link: [https://github.com/aliihsaad/DeutschBoost](https://github.com/aliihsaad/DeutschBoost)
