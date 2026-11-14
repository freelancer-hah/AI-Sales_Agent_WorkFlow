 # Cybells AI-Powered B2B Lead Generation & Sales Automation Platform

> A production-grade, zero-paid-dependency B2B company discovery, automated outreach, and AI-powered lead qualification engine built for Cybells.

---

## 🚀 Overview

Cybells AI-Powered B2B Sales Platform automates the end-to-end sales prospecting funnel across four major phases:
1. **Phase 1: Find Potential Customers** *(Completed)* — Multi-source discovery of target accounts, executive decision-makers (CEOs, owners, directors), and automated AI operational pain-point analysis using OpenStreetMap & SearXNG.
2. **Phase 2: Engage Prospects** *(Completed)* — Grounded outbound email generation, spam check, multi-step campaign sequences, sandbox guard, IMAP two-way email sync, inbound reply classification, and website inquiry assistant.
3. **Phase 3: AI-Powered Lead Qualification Agent** *(Completed)* — Autonomous conversational qualification, dynamic question generation, multi-dimensional B2B scoring, human review decision workflow, and sales handoff dossier generation.
4. **Phase 4: Convert Interest into Sales Meetings** *(Completed)* — Calendar availability negotiation, Gemini NLP time slot parsing, RFC 5545 `.ics` calendar invite generation, automated reminders & recovery cadence, executive closer dossier, and interactive Meetings Hub.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts
- **Backend**: Node.js (v20+ or v24+), Express.js, TypeScript, Mongoose
- **Database**: MongoDB Community Edition or MongoDB Atlas
- **AI Reasoning**: Google Gemini API via official `@google/genai` SDK (`gemini-2.5-flash`)
- **Email Infrastructure**: Nodemailer (SMTP transport with Sandbox Guard) & ImapFlow (Two-way synchronization)
- **Data Discovery & Scraping**: OpenStreetMap Overpass API, SearXNG, BeautifulSoup4 / Crawl4AI
- **Data Export**: Standard RFC-compliant CSV & Excel (`exceljs`)
- **Testing**: Vitest, Supertest, MongoMemoryServer (Zero quota consumption during test runs)

---

## 📋 Prerequisites

Before running the project on Windows:

1. **Node.js**: v20 or v24 installed (`node -v`)
2. **MongoDB**: Local MongoDB Community Edition running on port 27017, Docker container (`docker run -d -p 27017:27017 mongo`), or a free MongoDB Atlas connection string.
3. **Google Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/).

---

## ⚙️ Configuration (`.env`)

In the `backend` folder, check `backend/.env` (or copy from `backend/.env.example`):

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Configuration (local MongoDB or MongoDB Atlas)
MONGODB_URI=mongodb://localhost:27017/sales_agent

# Google Gemini AI Configuration
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Discovery Sources
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
SEARXNG_URL=http://localhost:8080

# Python Scraper Service URL
SCRAPER_SERVICE_URL=http://localhost:8000
```

---

## 🏃 How to Run the Project (Step-by-Step)

### Option 1: Run Backend and Frontend in Separate Terminals (Recommended)

#### Terminal 1: Start Backend API Server
```powershell
# From the project root:
cd backend
npm run dev
```
*The backend API will start on `http://localhost:5000` (Health check at `http://localhost:5000/api/health`).*

#### Terminal 2: Start Frontend Dashboard
```powershell
# From the project root:
cd frontend
npm run dev
```
*The Vite frontend will open at `http://localhost:5173`.*

#### Terminal 3: Start Python Scraping Service
```powershell
# From the project root:
python scraper/main.py
```
*The FastAPI scraping microservice will start on `http://localhost:8000` (Health check at `http://localhost:8000/health`).*

---

### Option 2: Run Using Root Scripts

From the root directory (`sales aget/`):

```powershell
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

---

## 🧪 Running Automated Tests

Run the full backend test suite (unit and integration tests verifying schema validation, SSRF protection, API endpoints, and database queries):

```powershell
cd backend
npm test
```

To run a production build verification:

```powershell
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

---

## 🌐 Application Architecture

```
sales aget/
├── backend/                  # Express + TypeScript API Server
│   ├── src/
│   │   ├── config/           # Database connection, env loader, logger
│   │   ├── controllers/      # Health, Dashboard, Company, Search, DecisionMaker, AI, Export, Outreach, Qualification
│   │   ├── middleware/       # Error handling, request logger, Zod validators
│   │   ├── models/           # Mongoose schemas: Company, DecisionMaker, SearchJob, Source,
│   │   │                     # OutreachContact, EmailMessage, Campaign, SuppressionList,
│   │   │                     # LeadQualification, QualificationQuestion, QualificationActivity,
│   │   │                     # SalesMeeting, HostAvailability
│   │   ├── routes/           # REST endpoints: /api/companies, /api/outreach, /api/qualifications, /api/meetings
│   │   ├── services/         # Scraper, Gemini AI, Outreach, IMAP, LeadQualification, SalesHandoff,
│   │   │                     # meetingAvailabilityService, salesMeetingService, icsCalendarService,
│   │   │                     # geminiMeetingParserService, meetingReminderService, executiveDossierService
│   │   └── utils/            # Normalizers, SSRF urlValidator
│   └── tests/                # Automated vitest suite (Unit, Integration & E2E tests: 102+ passing)
├── frontend/                 # React + Vite + Tailwind Dashboard
│   ├── src/
│   │   ├── components/       # StatCards, Sidebar, Navbar, CompanyModal, Skeletons, Badges
│   │   ├── pages/            # Phase 1: Overview, FindCompanies, AllCompanies, DecisionMakers, AIOpportunities
│   │   │                     # Phase 2: OutreachDashboard, Campaigns, Templates, Inbox
│   │   │                     # Phase 3: QualificationDashboard
│   │   │                     # Phase 4: MeetingsHub
│   │   └── services/         # Typed API clients (api.ts)
└── scraper/                  # Python microservice (FastAPI, BeautifulSoup, Crawl4AI)
```

---

## 🎯 Phase 3: AI-Powered Lead Qualification Agent

Phase 3 introduces an autonomous qualification engine that engages interested prospects from Phase 2, extracts structured operational information, scores their readiness across six key B2B dimensions, and provides an end-to-end human review and sales handoff workflow.

### 🧩 4 Implementation Milestones

1. **Milestone 1 — Database, Qualification Foundation & Phase 2 Integration**
   - Data models: `LeadQualification`, `QualificationQuestion`, `QualificationActivity`.
   - Eligibility checks preventing suppressed, unsubscribed, or already active leads from entering qualification.
   - Idempotency & state machine (`not_started`, `in_progress`, `awaiting_information`, `ready_for_review`, `qualified`, `disqualified`, `paused`).

2. **Milestone 2 — Gemini-Powered Conversational Qualification & Information Extraction**
   - Autonomous extraction of structured B2B facts (business challenges, software systems, workflows, desired AI solution, timeline, budget, authority).
   - Dynamic question generator: Context-aware, non-repetitive qualification questions.
   - Grounded outbound response drafter with Cybells knowledge base injection and mandatory human approval guard (`approvalStatus: 'draft'`).

3. **Milestone 3 — AI Lead Scoring, Qualification Decisions & Human Review Dashboard**
   - **6-Dimension Scoring Model (Max 100 Points)**:
     - Need Clarity & Pain Point Severity: **25 pts**
     - Cybells Solution Fit & Automation Value: **25 pts**
     - Engagement & Responsiveness: **20 pts**
     - Purchasing / Implementation Timeline: **15 pts**
     - Decision-Making Authority: **10 pts**
     - Budget Readiness: **5 pts**
   - Auto-promotion: Score &ge; 70 automatically moves lead to `ready_for_review`.
   - Dedicated `QualificationDashboard.tsx` with pipeline metrics, lead drawer, visual score gauges, AI tools, and human review decision workflow (Approve SQL, Disqualify, More Info Needed).

4. **Milestone 4 — Sales Handoff, Security & Export Integration**
   - Complete Handoff Package generation: Account Dossier, BANT summary, conversation audit logs, and account executive assignment (`assignedTo`).
   - One-click CSV and JSON exports for CRM handoff.
   - Robust safety rails: Anti-prompt injection defense, strict human review gate, and global suppression enforcement.

---

## 📡 Qualification REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/qualifications` | Get paginated list of qualifications with filter tabs and pipeline stats |
| `GET` | `/api/qualifications/:id` | Get full qualification detail with populated company, contact, and questions |
| `POST` | `/api/qualifications/start` | Manually or systematically initiate a lead qualification |
| `PATCH` | `/api/qualifications/:id` | Update structured qualification fields (BANT, systems, workflows) |
| `PATCH` | `/api/qualifications/:id/status` | Update qualification status with audit log |
| `GET` | `/api/qualifications/check-eligibility/:contactId` | Check if a contact is eligible for qualification |
| `POST` | `/api/qualifications/:id/extract` | Extract structured business facts from an inbound message |
| `POST` | `/api/qualifications/:id/generate-question` | Generate the next contextual qualification question |
| `POST` | `/api/qualifications/:id/generate-draft` | Generate a grounded Cybells reply draft for human approval |
| `GET` | `/api/qualifications/:id/questions` | List qualification questions |
| `PATCH` | `/api/qualifications/:id/questions/:questionId` | Update answer or status of a qualification question |
| `POST` | `/api/qualifications/:id/score` | Run Gemini multidimensional scoring (0-100) and evaluation |
| `POST` | `/api/qualifications/:id/review` | Submit human review decision (`approved_qualified`, `disqualified`, `more_info_needed`) |
| `POST` | `/api/qualifications/:id/handoff` | Generate sales handoff package and assign Account Executive |
| `GET` | `/api/qualifications/:id/export` | Download full qualification dossier in standardized JSON format |
| `GET` | `/api/qualifications/export/csv` | Download complete qualification pipeline in RFC-compliant CSV format |

---

## 📅 Phase 4: Convert Interest into Sales Meetings

Phase 4 automates the appointment scheduling workflow: turning qualified prospect interest into confirmed discovery meetings, with automated availability checks, natural language time negotiations, standard `.ics` calendar invites, multi-touch reminder cadences, and 1-page executive closer dossiers.

### 🧩 4 Implementation Milestones

1. **Milestone 1 — Sales Meeting Database Models, Host Availability Engine & Direct Booking Core**
   - Models: `SalesMeeting` (Google Meet link, `icsUid`, sequence, attendees, outcomes, reminders) and `HostAvailability` (working hours Mon-Fri 09:00–18:00, 15m buffer, 6 max/day, blackout dates).
   - Dynamic conflict-free slot calculation engine preventing overlaps, double-bookings, weekends, and past slots.
   - Status transitions (`proposed`, `confirmed`, `rescheduled`, `completed`, `cancelled`, `no_show`).

2. **Milestone 2 — Gemini Natural Language Time Slot Parser & RFC 5545 `.ics` Calendar Generator**
   - Pure TypeScript RFC 5545 `.ics` generator with CRLF formatting, `METHOD:REQUEST`/`METHOD:CANCEL`, sequence management, and standard `VALARM` alerts (Zero paid Calendly / Cal.com dependency).
   - Gemini NLP intent parser identifying:
     - `time_confirmed`: Exact time slot locked.
     - `propose_alternative`: Prospect suggests alternative date/time.
     - `request_options`: Prospect asks for available openings.
     - `uninterested`: Prospect declines the call.
   - Grounded invitation email drafts with `.ics` calendar attachments held for human review (`pending_approval`).

3. **Milestone 3 — Automated Meeting Follow-Ups, Reschedule / Cancellation Engine & Outreach Integration**
   - Reschedule engine: Increments RFC 5545 `sequence` (0 -> 1 -> 2), updates meeting record, and generates updated calendar attachment.
   - Cancellation engine: Issues `METHOD:CANCEL` calendar updates, frees slot availability, and logs cancellation reasons.
   - Automated reminder cadences:
     - 24-Hour advance reminder.
     - 1-Hour urgent reminder with direct Google Meet URL.
     - No-show recovery with fresh proposed slots.
     - Follow-up nudge for pending proposals.
   - Outcome logging (`deal_in_progress`, `closed_won`, `closed_lost`, `technical_mismatch`) with automatic `converted` contact status propagation.

4. **Milestone 4 — Meetings Management Hub UI (`/meetings`), Executive Closer Dossier & End-to-End Integration**
   - Executive Closer Dossier: 1-page pre-call intelligence brief synthesizing Phase 1 account data, Phase 2 outreach logs, and Phase 3 BANT scores with strategic talking points and objection responses.
   - Interactive `MeetingsHub.tsx`: Live KPI summary cards, status filter tabs, action menus (Join Google Meet, download `.ics`, Reschedule, Cancel, Log Outcome), Closer Dossier drawer, and Host Working Hours configuration modal.
   - Direct cross-phase booking from `QualificationDashboard.tsx` for qualified accounts.

---

## 📡 Meetings REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/meetings` | Get paginated list of meetings with status filters |
| `GET` | `/api/meetings/stats` | Pipeline metrics (total, upcoming, confirmed, rescheduled, completed, cancelled) |
| `GET` | `/api/meetings/availability/slots` | Calculate candidate available time slots for a date window |
| `GET` | `/api/meetings/availability/settings` | Get host working hours, buffers, and blackout dates |
| `PUT` | `/api/meetings/availability/settings` | Update host calendar availability configuration |
| `POST` | `/api/meetings/propose-slots` | Generate top recommended meeting slots |
| `POST` | `/api/meetings/parse-slots` | Parse prospect natural language reply for booking intent |
| `POST` | `/api/meetings` | Book a new sales meeting |
| `GET` | `/api/meetings/:id` | Get full sales meeting details |
| `PATCH` | `/api/meetings/:id/status` | Update meeting status with audit history |
| `GET` | `/api/meetings/:id/ics` | Download standard RFC 5545 `.ics` calendar file |
| `POST` | `/api/meetings/:id/generate-invite-draft` | Generate calendar invite email draft with `.ics` attachment |
| `POST` | `/api/meetings/:id/reschedule` | Reschedule meeting with sequence increment |
| `POST` | `/api/meetings/:id/cancel` | Cancel meeting and issue RFC 5545 cancellation |
| `POST` | `/api/meetings/:id/outcome` | Record call outcome and cascade contact conversion |
| `POST` | `/api/meetings/:id/remind` | Send 24h, 1h, no-show, or follow-up reminder draft |
| `POST` | `/api/meetings/reminders/process-due` | Batch process due reminders across all scheduled meetings |
| `GET` | `/api/meetings/:id/dossier` | Retrieve 1-page executive closer dossier |
| `POST` | `/api/meetings/:id/dossier/generate` | Regenerate executive closer briefing |

---

## 🔍 Key Dashboard Views

1. **Overview**: Live metric cards (total discovered, with websites, with public emails, phone numbers, decision makers, high relevance leads) and Recharts analytics.
2. **Find Companies**: Dedicated search form supporting industry, niche category, search keywords, city/country location, company size, services, and Gemini AI automation requirements.
3. **All Companies**: Complete searchable table with sorting, filters, detail slide-over modals, and CSV/Excel exports.
4. **Decision Makers**: Identified founders, CEOs, directors, contact info, confidence ratings, and source evidence.
5. **AI Opportunities**: Gemini-generated business pain points and proposed AI solutions.
6. **Outreach & Campaigns (Phase 2)**: Cold email generation, review gates, automated cadence scheduling, and inbox monitoring.
7. **Lead Qualifications (Phase 3)**: Pipeline summary cards, multidimensional scoring gauges, AI conversation assistants, human decision reviews, and sales AE handoffs.
8. **Meetings Hub (Phase 4)**: Real-time appointments dashboard, Google Meet links, `.ics` downloads, Closer Dossier briefings, rescheduling/cancellation controls, and host availability preferences.
9. **Settings**: Integration connectivity status check for Gemini, MongoDB, Overpass, and SearXNG.

