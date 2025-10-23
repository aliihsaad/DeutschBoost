# DeutschBoost

A personalized German language learning platform powered by AI. Learn German through adaptive lessons, AI conversations, and personalized learning plans.

## Features

- **Placement Test**: Assess your German language level (A1-C2)
- **Personalized Learning Plans**: Get customized learning paths based on your level and goals
- **AI Conversations**: Practice German with AI-powered conversations using Google Gemini
- **Progress Tracking**: Monitor your learning progress and achievements
- **User Authentication**: Secure authentication powered by Supabase

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (via CDN)
- **AI**: Google Gemini AI API
- **Backend**: Supabase (Authentication & Database)
- **Deployment**: Vercel

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

## Database Setup

The app uses Supabase for data storage. To set up the database:

1. Create a new project in [Supabase](https://supabase.com)
2. Run the migration file located at `supabase/migrations/001_initial_schema.sql` in your Supabase SQL editor
3. Copy your project URL and anon key to `.env.local`

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
