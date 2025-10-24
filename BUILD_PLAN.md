# DeutschBoost - Build Plan & Progress

## Project Overview

**DeutschBoost** is an AI-powered German language learning platform designed to help users master German from A1 to C2 levels and prepare for official Goethe-Zertifikat exams.

### Current Status: MVP Complete ✅
- Basic placement test (Reading + Writing)
- AI-generated personalized learning plans
- Real-time AI conversation practice
- Basic progress tracking
- Simple dashboard with charts

---

## Target Audience
- German language learners (A1-C2 levels)
- Students preparing for Goethe-Zertifikat exams
- Professionals needing German for work
- University applicants requiring German proficiency

---

## Requirements

### Technical Requirements

#### Frontend
- [x] React 19.2.0
- [x] TypeScript 5.8.2
- [x] Vite 6.2.0
- [x] Tailwind CSS (needs to be added)
- [x] Recharts 3.3.0
- [ ] React Router (for better routing)
- [ ] Zustand or Redux (state management)
- [ ] React Query (data fetching & caching)
- [ ] React Hook Form (form handling)
- [ ] Zod (validation)

#### Backend & Database
- [ ] Supabase
  - [ ] PostgreSQL Database
  - [ ] Authentication (Email, Google OAuth)
  - [ ] Real-time subscriptions
  - [ ] Row Level Security (RLS)
  - [ ] Storage for audio files
- [ ] Supabase Functions (serverless)

#### AI Services
- [x] Google Gemini AI API
  - [x] gemini-2.5-flash (placement tests)
  - [x] gemini-2.5-pro (evaluation & learning plans)
  - [x] gemini-2.5-flash-native-audio (conversations)
  - [x] gemini-2.5-flash-preview-tts (text-to-speech)

#### Payment Processing
- [ ] Stripe integration
- [ ] Subscription management
- [ ] Webhook handling

#### Infrastructure
- [x] Vercel deployment (Live at https://deutsch-boost.vercel.app)
- [x] Environment variables management
- [ ] Error tracking (Sentry)
- [ ] Analytics (Plausible/Google Analytics)

### Content Requirements
- [ ] Goethe-Zertifikat exam specifications for all levels
- [ ] Sample questions bank (Lesen, Hören, Schreiben, Sprechen)
- [ ] Audio materials for listening practice
- [ ] Grammar explanations database
- [ ] Vocabulary lists (A1-C2)
- [ ] Example essays for each level

---

## Database Schema Design

### Tables

#### `users`
```sql
- id (uuid, PK)
- email (text, unique)
- full_name (text)
- avatar_url (text)
- subscription_tier (enum: 'free', 'premium')
- subscription_status (enum: 'active', 'canceled', 'expired')
- subscription_end_date (timestamp)
- created_at (timestamp)
- last_active (timestamp)
```

#### `user_profiles`
```sql
- id (uuid, PK, FK to users)
- current_level (enum: A1, A2, B1, B2, C1, C2)
- target_level (enum: A1, A2, B1, B2, C1, C2)
- target_exam_date (date, nullable)
- daily_goal_minutes (integer, default: 30)
- notification_preferences (jsonb)
- study_streak (integer, default: 0)
- total_study_time (integer, default: 0)
- updated_at (timestamp)
```

#### `test_results`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- test_type (enum: 'placement', 'practice', 'mock_exam')
- level (enum: A1, A2, B1, B2, C1, C2)
- sections (jsonb) -- {reading: score, writing: score, listening: score, speaking: score}
- overall_score (integer)
- strengths (text[])
- weaknesses (text[])
- recommendations (text)
- completed_at (timestamp)
```

#### `learning_plans`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- test_result_id (uuid, FK to test_results)
- target_level (enum)
- goals (text[])
- duration_weeks (integer)
- is_active (boolean)
- created_at (timestamp)
```

#### `learning_plan_items`
```sql
- id (uuid, PK)
- learning_plan_id (uuid, FK to learning_plans)
- week_number (integer)
- week_focus (text)
- topic (text)
- skill (enum: 'Grammar', 'Vocabulary', 'Listening', 'Writing', 'Speaking')
- description (text)
- completed (boolean, default: false)
- completed_at (timestamp, nullable)
```

#### `flashcards`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- word_german (text)
- word_english (text)
- example_sentence (text)
- audio_url (text)
- level (enum: A1, A2, B1, B2, C1, C2)
- next_review_date (timestamp)
- review_count (integer, default: 0)
- ease_factor (float, default: 2.5)
- created_at (timestamp)
```

#### `conversation_sessions`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- duration_seconds (integer)
- transcript (jsonb)
- feedback (text)
- started_at (timestamp)
- ended_at (timestamp)
```

#### `achievements`
```sql
- id (uuid, PK)
- name (text)
- description (text)
- icon (text)
- criteria (jsonb)
- points (integer)
```

#### `user_achievements`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- achievement_id (uuid, FK to achievements)
- earned_at (timestamp)
```

#### `study_sessions`
```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- activity_type (enum: 'conversation', 'flashcards', 'listening', 'reading', 'writing', 'grammar')
- duration_minutes (integer)
- items_completed (integer)
- date (date)
```

---

## Enhancement Plan

### Phase 1: Foundation - Supabase Integration & Authentication
**Status:** ✅ COMPLETE
**Priority:** Critical
**Completed:** 2025-10-23

#### Tasks
- [x] Create Supabase project
- [x] Design and implement database schema
- [x] Set up Row Level Security (RLS) policies
- [x] Implement authentication system
  - [x] Email/password signup and login
  - [x] Google OAuth integration
  - [x] Password reset flow
  - [x] Email verification
- [x] Create authentication context and hooks
- [x] Implement protected routes
- [x] Build user profile page with real data
- [x] Migrate existing features to use Supabase
  - [x] Save test results to database
  - [x] Persist learning plan progress
  - [x] Store user preferences
- [x] Deploy to Vercel
- [x] Set up GitHub repository
- [x] Configure production environment variables

**Success Criteria:**
- ✅ Users can create accounts and log in
- ✅ All user data persists across sessions
- ✅ Protected routes work correctly
- ✅ Deployed to production at https://deutsch-boost.vercel.app
- ✅ GitHub repository: https://github.com/aliihsaad/DeutschBoost

---

### Phase 2: Goethe-Zertifikat Focused Features
**Status:** ⏳ Not Started
**Priority:** High
**Estimated Time:** 2-3 weeks

#### Tasks
- [ ] Research Goethe-Zertifikat exam formats for all levels
- [ ] Build comprehensive placement test
  - [ ] Lesen (Reading) section
  - [ ] Hören (Listening) section with audio
  - [ ] Schreiben (Writing) section
  - [ ] Sprechen (Speaking) section with AI
  - [ ] Adaptive difficulty algorithm
- [ ] Create practice exam simulator
  - [ ] Full-length mock exams (A1-C2)
  - [ ] Timer functionality
  - [ ] Exam-like interface
  - [ ] Automatic scoring
  - [ ] Detailed performance report
- [ ] Build listening practice module
  - [ ] Audio player with controls
  - [ ] Multiple listening exercises per level
  - [ ] Transcript reveal functionality
  - [ ] Playback speed adjustment
- [ ] Implement AI-powered scoring system
  - [ ] Align with Goethe evaluation criteria
  - [ ] Detailed feedback per section

**Success Criteria:**
- Users can take full practice exams
- Scoring matches official Goethe criteria
- Listening module works smoothly

---

### Phase 1.5: Interactive Learning Activities
**Status:** ✅ COMPLETE
**Priority:** Critical
**Completed:** 2025-10-24

#### Tasks
- [x] Build activity generation system
  - [x] Grammar exercises with AI-generated questions
  - [x] Vocabulary practice with flashcard-style matching
  - [x] Writing tasks with AI evaluation
  - [x] Speaking practice integration (uses conversation page)
  - [x] Listening comprehension (placeholder for future audio)
- [x] Integrate activities with learning plans
  - [x] Add "Start Activity" buttons to plan items
  - [x] Route to appropriate activity based on skill type
  - [x] Pass context (topic, description, level) to activities
- [x] Implement automatic completion tracking
  - [x] Mark items as complete when score >= 70%
  - [x] Update database automatically
  - [x] Show completion status in learning plan
- [x] Add mother language support
  - [x] Store user's native language in profile
  - [x] Use in activity instructions (ready for implementation)

**Success Criteria:**
- ✅ Users can start interactive activities from their learning plan
- ✅ Activities are AI-generated based on their level
- ✅ Completion automatically tracked in database
- ✅ All 5 skill types supported (Grammar, Vocabulary, Listening, Writing, Speaking)

**TODO for Future:**
- [ ] Use user's mother language in activity instructions and explanations
  - Currently the mother_language field is stored but not yet used in AI prompts
  - Update activityService.ts to include `userMotherLanguage` parameter
  - Modify AI prompts to generate instructions in user's native language
  - Example: "Provide instructions in {mother_language} but German content should remain in German"

---

### Phase 3: Enhanced Learning Features
**Status:** ⏳ Not Started
**Priority:** High
**Estimated Time:** 3-4 weeks

#### Tasks
- [ ] Spaced repetition flashcard system
  - [ ] Flashcard creation interface
  - [ ] AI-generated vocabulary cards
  - [ ] Audio pronunciation integration
  - [ ] SM-2 algorithm implementation
  - [ ] Review scheduler
  - [ ] Statistics dashboard
- [ ] Grammar practice module
  - [ ] Grammar topic library (A1-C2)
  - [ ] Interactive exercises
  - [ ] AI-powered feedback
  - [ ] Progress tracking per topic
- [ ] Writing practice enhancement
  - [ ] Multiple essay/email prompts
  - [ ] Timed writing mode
  - [ ] AI evaluation with detailed feedback
  - [ ] Revision history
  - [ ] Sample answer comparisons
- [ ] Expand learning plans
  - [ ] 12-week plans instead of 4
  - [ ] Weekly progress reports via email
  - [ ] Adaptive difficulty adjustments
  - [ ] Milestone celebrations

**Success Criteria:**
- Flashcard system increases retention
- Grammar exercises provide value
- Writing feedback is actionable

---

### Phase 4: Premium Features & Monetization
**Status:** ⏳ Not Started
**Priority:** Medium
**Estimated Time:** 2 weeks

#### Tasks
- [ ] Define free vs premium feature set
  - **FREE Tier:**
    - 1 placement test per month
    - 10 minutes AI conversation per day
    - 50 flashcards
    - Basic learning plan
    - Ads displayed
  - **PREMIUM Tier ($9.99/month):**
    - Unlimited placement tests
    - Unlimited AI conversations
    - Unlimited flashcards
    - Full exam simulator access
    - Advanced analytics
    - Ad-free experience
    - Downloadable progress reports
    - Priority support
- [ ] Integrate Stripe payment processing
  - [ ] Subscription checkout
  - [ ] Payment method management
  - [ ] Invoice generation
  - [ ] Webhook handlers
- [ ] Implement usage limits for free tier
- [ ] Build subscription management interface
- [ ] Add 14-day free trial
- [ ] Create pricing page

**Success Criteria:**
- Users can subscribe successfully
- Usage limits enforce properly
- Billing works without errors

---

### Phase 5: Engagement & Retention Features
**Status:** ⏳ Not Started
**Priority:** Medium
**Estimated Time:** 2 weeks

#### Tasks
- [ ] Gamification system
  - [ ] XP points system
  - [ ] Achievement/badge system
  - [ ] Daily streak tracking
  - [ ] Leaderboard (optional, privacy-first)
  - [ ] Level-up animations
- [ ] Advanced analytics dashboard
  - [ ] Progress over time charts
  - [ ] Strengths/weaknesses heatmap
  - [ ] Study time tracking
  - [ ] Exam readiness score
  - [ ] Comparative performance graphs
- [ ] Notification system
  - [ ] Email reminders for inactive users
  - [ ] Daily study streak notifications
  - [ ] Exam countdown alerts
  - [ ] Weekly progress summaries
- [ ] Study calendar
  - [ ] Daily activity log
  - [ ] Study goal setting
  - [ ] Habit tracking

**Success Criteria:**
- Users feel motivated to return daily
- Analytics provide meaningful insights
- Notifications increase engagement

---

### Phase 6: Polish & Additional Features
**Status:** ⏳ Not Started
**Priority:** Low
**Estimated Time:** 2-3 weeks

#### Tasks
- [ ] Vocabulary builder from context
  - [ ] Save unknown words during practice
  - [ ] AI-generated context sentences
  - [ ] Word frequency analysis
  - [ ] Personal vocabulary list
- [ ] Community features (optional)
  - [ ] Study groups
  - [ ] Language exchange matching
  - [ ] Discussion forum
  - [ ] Success stories
- [ ] Mobile optimization
  - [ ] PWA configuration
  - [ ] Offline mode for flashcards
  - [ ] Responsive layouts
  - [ ] Touch-optimized interfaces
- [ ] Accessibility improvements
  - [ ] ARIA labels
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] High contrast mode
- [ ] SEO optimization
  - [ ] Meta tags
  - [ ] Open Graph images
  - [ ] Sitemap generation
  - [ ] Blog for content marketing
- [ ] Performance optimization
  - [ ] Code splitting
  - [ ] Lazy loading
  - [ ] Image optimization
  - [ ] Caching strategy

**Success Criteria:**
- App works well on mobile devices
- Accessible to users with disabilities
- Good SEO rankings

---

## Technical Debt & Improvements

### Current Issues to Address
- [ ] Add proper TypeScript strict mode
- [ ] Implement error boundaries
- [ ] Add comprehensive error handling
- [ ] Improve loading states
- [ ] Add proper routing with React Router
- [ ] Implement state management (Zustand)
- [ ] Add unit tests (Vitest)
- [ ] Add E2E tests (Playwright)
- [ ] Set up CI/CD pipeline
- [ ] Add environment variable validation
- [ ] Implement logging system
- [ ] Add rate limiting for API calls

---

## Environment Variables Required

```env
# Gemini AI
API_KEY=your_gemini_api_key

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# App
VITE_APP_URL=http://localhost:5173
NODE_ENV=development
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@stripe/stripe-js": "^3.x",
    "react-router-dom": "^6.x",
    "zustand": "^4.x",
    "@tanstack/react-query": "^5.x",
    "react-hook-form": "^7.x",
    "zod": "^3.x",
    "date-fns": "^3.x",
    "react-hot-toast": "^2.x"
  },
  "devDependencies": {
    "@types/react-router-dom": "^5.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "playwright": "^1.x"
  }
}
```

---

## Success Metrics

### User Engagement
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Average session duration
- Study streak retention rate
- Return rate after 7 days

### Learning Outcomes
- Average level progression time
- Test score improvements
- Completion rate of learning plans
- Flashcard retention rates

### Business Metrics
- Free to Premium conversion rate (Target: 5-10%)
- Monthly Recurring Revenue (MRR)
- Customer Lifetime Value (LTV)
- Churn rate (Target: <5% monthly)

---

## Launch Checklist

### Pre-Launch
- [ ] Complete Phase 1-3
- [ ] User testing with 10-20 beta users
- [ ] Fix critical bugs
- [ ] Performance optimization
- [ ] Security audit
- [ ] Privacy policy and terms of service
- [ ] GDPR compliance
- [ ] Analytics setup

### Launch
- [ ] Deploy to production
- [ ] Announce on social media
- [ ] Product Hunt launch
- [ ] Reddit communities (r/German, r/languagelearning)
- [ ] Email marketing campaign
- [ ] Blog post announcement

### Post-Launch
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Weekly feature iterations
- [ ] Customer support setup

---

## Future Ideas (Backlog)

- Mobile app (React Native)
- German grammar checker browser extension
- Integration with language exchange platforms
- Video lessons from native speakers
- Cultural context lessons
- Business German specialization
- Certificate of completion
- Referral program
- Corporate/team accounts
- AI tutor with personality customization
- Integration with Anki
- German news reader with difficulty adjustment

---

## Timeline Estimate

**Total Development Time:** 12-16 weeks for core features

- Phase 1: Weeks 1-2
- Phase 2: Weeks 3-5
- Phase 3: Weeks 6-9
- Phase 4: Weeks 10-11
- Phase 5: Weeks 12-13
- Phase 6: Weeks 14-16

**MVP for Beta Launch:** After Phase 3 (Week 9)
**Full Launch:** After Phase 4 (Week 11)

---

## Notes & Decisions

### Technology Choices
- **Why Supabase?** Open-source, PostgreSQL-based, excellent real-time features, generous free tier
- **Why Stripe?** Industry standard, excellent documentation, supports subscriptions
- **Why Gemini AI?** Multimodal capabilities, native audio support, cost-effective

### Design Principles
- Mobile-first responsive design
- Accessibility is non-negotiable
- Privacy-focused (minimal data collection)
- Fast loading times (<3s)
- Intuitive UX (minimize clicks to value)

---

**Last Updated:** 2025-10-23
**Version:** 1.0
