# DeutschBoost

A personalized German language learning platform powered by AI. Learn German through adaptive lessons, AI conversations, and interactive activities tailored to your proficiency level.

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
Five types of AI-generated activities:

1. **Grammar Exercises**: Fill-in-the-blank questions with detailed explanations
2. **Vocabulary Practice**: Flashcard-style matching and translation exercises
3. **Listening Comprehension**: Audio-based exercises with questions (coming soon)
4. **Writing Tasks**: AI-evaluated writing with feedback on grammar, vocabulary, and fluency
5. **Speaking Practice**: Real-time AI conversation partner using voice recognition

### 💬 AI Conversation Partner
- Natural conversations with Google Gemini AI
- Adapts to your language level
- Provides corrections and suggestions
- Practice real-world German in a safe environment

### 📊 Progress Tracking
- Track completion of learning plan activities
- Monitor your study streak
- View detailed performance metrics
- Celebrate achievements and milestones

### 🌍 Multi-Language Support
- Set your native language for better learning experience
- Instructions and explanations in your mother tongue
- Supports English, Arabic, and more

### 🔐 Secure User Management
- Email/password authentication
- Google OAuth integration
- Profile customization with avatar support
- Secure data storage with Supabase

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (via CDN)
- **AI**: Google Gemini AI (2.5 Flash & 2.5 Pro)
- **Backend**: Supabase (Authentication, Database, Row Level Security)
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
3. Copy your project URL and anon key to `.env.local`
4. Enable Google OAuth in Supabase Authentication settings (optional)

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
│   ├── lib/            # Library configurations
│   ├── pages/          # Auth pages (Login, Signup)
│   └── types/          # TypeScript type definitions
├── components/         # Main components
├── pages/             # Application pages
├── services/          # API services (Gemini)
├── supabase/          # Database migrations
└── public/            # Static assets
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Contact

Created by [aliihsaad](https://github.com/aliihsaad)

Project Link: [https://github.com/aliihsaad/DeutschBoost](https://github.com/aliihsaad/DeutschBoost)
