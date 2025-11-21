# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev           # Start development server (http://localhost:5173)
npm run build         # Production build
npm run preview       # Preview production build
npm run test          # Run tests in watch mode
npm run test:run      # Run all tests once
npm run test:coverage # Run tests with coverage report
```

## Architecture Overview

### Tech Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (via PostCSS)
- Supabase (PostgreSQL + Auth)
- Google Gemini AI (2.5 Flash for activities, 2.5 Pro for feedback, Live for voice)
- Zustand for state management
- React Query for server state

### Project Structure

The codebase uses a mixed structure with top-level folders:

- **`/App.tsx`** - Entry point with routing, auth provider, error boundary
- **`/MainApp.tsx`** - Main authenticated app with nested routes and learning plan state
- **`/pages/`** - Top-level page components (EnhancedPlacementTestPage, LearningPlanPage, ConversationPage, ActivityPage, etc.)
- **`/services/`** - API and business logic:
  - `geminiService.ts` - All AI prompts and API calls for activities, assessments, conversation modes
  - `conversationService.ts` - Conversation history and feedback persistence
  - `learningPlanService.ts` - Learning plan CRUD and progress tracking
  - `activityService.ts` - Activity generation (Grammar, Vocab, Reading, Listening, Writing)
  - `practiceService.ts` - Practice/exam simulation features
- **`/components/`** - Reusable UI components (Header, Card, LoadingSpinner, ConversationHistoryCard)
- **`/src/`** - Core infrastructure:
  - `contexts/AuthContext.tsx` - Supabase auth state
  - `lib/supabase.ts` - Supabase client
  - `types/` - TypeScript definitions (database.types.ts, activity.types.ts)
  - `components/` - Auth-related components (ProtectedRoute, ErrorBoundary, PWAPrompt)
  - `pages/` - Auth pages (LoginPage, SignupPage)
- **`/types.ts`** - Main type definitions (CEFRLevel, LearningPlan, TestResult, Page enum)
- **`/supabase_migrations/`** - Database migration SQL files
- **`/utils/`** - Shared utilities:
  - `safeJsonParse.ts` - Safe JSON parsing with error handling
  - `supabaseQuery.ts` - Query timeout wrappers and error utilities
- **`/tests/`** - Test files mirroring source structure

### Key Patterns

**Path Aliases**: Use `@/*` to import from project root (configured in tsconfig.json)

**TypeScript**: Strict mode enabled with noUncheckedIndexedAccess - handle potential undefined values from array/object access

**Activity Flow**: Learning plan items link to activities via database IDs. ActivityPage and SpeakingActivityPage auto-complete items when user scores 70%+

**AI Integration**:
- `geminiService.ts` contains all AI prompts for different learning modes
- Conversation sessions store transcripts and AI-generated feedback as JSONB
- AI loads previous session feedback to provide context-aware responses

**Authentication**: Supabase with RLS policies. All user data queries must include user_id filtering.

**Error Handling**:
- Use `parseAiJsonResponse()` from utils for all AI JSON responses
- Use `safeJsonParse()` for user data that may be malformed
- Always handle `.single()` query errors (check for PGRST116 code for "not found")

### Environment Variables

Required in `.env.local`:
- `GEMINI_API_KEY` / `API_KEY` - Google Gemini API
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `VITE_APP_URL` - App URL (default: http://localhost:5173)

### Database

Supabase PostgreSQL with these key tables:
- `user_profiles` - User data with current_level, mother_language
- `learning_plans` / `learning_plan_items` - Weekly learning schedules
- `conversation_sessions` - Conversation transcripts and AI feedback (JSONB)
- `test_results` - Placement test results
- `study_sessions` - Study streak and time tracking

Run migrations in order from `/supabase_migrations/` when setting up.
