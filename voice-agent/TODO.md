# Voice Agent for Construction Site Daily Updates - Implementation Plan

## Overview
A voice-based daily reporting system for construction sites where:
- **Site Workers** submit daily updates via voice
- **Site Managers** can listen to summaries and ask questions about updates

## Architecture

### User Roles
1. **Site Worker** - Submits daily voice updates
2. **Site Manager** - Reviews updates and queries information

### Data Flow
```
Worker Voice Input → STT → Store Original + Generate Summary (LLM) → Database
                                        ↓
Manager Query → STT → LLM (with context from updates) → TTS → Audio Response
```

---

## Implementation Tasks

### Phase 1: Database Models & Schema ✅ COMPLETED
- [x] Create `SiteWorker` model (id, name, employee_id, site_location, role)
- [x] Create `SiteManager` model (id, name, employee_id, managed_sites)
- [x] Create `DailyUpdate` model (id, worker_id, date, original_message, summary, audio_path, metadata)
- [x] Create `ManagerQuery` model (id, manager_id, query_type, worker_ids, question, answer)
- [x] Add database migrations and initialization

### Phase 2: Backend Services ✅ COMPLETED
- [x] Create `SummarizationService` - uses LLM to summarize worker updates
- [x] Create `QAService` - handles manager questions with context from updates
- [x] Update `OllamaLLM` service with construction-specific prompts
- [x] Create worker update processing pipeline

### Phase 3: API Endpoints ✅ COMPLETED

#### Worker Endpoints
- [x] `POST /api/worker/register` - Register a new site worker
- [x] `POST /api/worker/{worker_id}/update` - Submit daily voice update
- [x] `GET /api/worker/{worker_id}/updates` - Get worker's update history

#### Manager Endpoints
- [x] `POST /api/manager/register` - Register a new site manager
- [x] `GET /api/manager/updates/summary` - Get summarized updates (filter by date, worker, site)
- [x] `POST /api/manager/query/single` - Ask question about single worker's update
- [x] `POST /api/manager/query/multiple` - Ask question about multiple workers' updates
- [x] `GET /api/manager/updates/{update_id}/audio` - Get audio playback of summary

#### General Endpoints
- [x] `GET /api/sites` - List all construction sites
- [x] `GET /api/workers` - List all workers
- [x] `GET /api/updates/today` - Get today's updates

### Phase 4: Frontend Updates ✅ COMPLETED

#### Worker Interface
- [x] Worker login/selection screen
- [x] Daily update recording interface
- [x] Update history view

#### Manager Interface
- [x] Manager dashboard with summary view
- [x] Filter by date, worker, site
- [x] Q&A interface for single worker
- [x] Q&A interface for multiple workers (aggregate queries)
- [x] Audio playback for summaries

### Phase 5: Testing & Polish
- [ ] End-to-end testing
- [ ] Error handling improvements
- [ ] Performance optimization
- [ ] UI/UX refinements

---

## Technical Details

### Summary Generation Prompt
```
You are a construction site update summarizer. Given a worker's daily update, 
create a concise summary that captures:
- Work completed today
- Materials used
- Issues or blockers encountered
- Safety observations
- Progress percentage if mentioned

Keep the summary under 100 words while preserving key details.
```

### Q&A Context Building
For single worker queries:
- Include worker's recent updates (last 7 days)
- Focus on specific worker's context

For multi-worker queries:
- Aggregate updates from selected workers
- Provide cross-worker insights
- Compare progress across workers

### Database Schema

```sql
-- Site Workers
CREATE TABLE site_workers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    site_location VARCHAR(200),
    role VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site Managers  
CREATE TABLE site_managers (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    managed_sites JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Updates
CREATE TABLE daily_updates (
    id INTEGER PRIMARY KEY,
    worker_id INTEGER REFERENCES site_workers(id),
    update_date DATE NOT NULL,
    original_message TEXT NOT NULL,
    summary TEXT,
    audio_path VARCHAR(255),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manager Queries
CREATE TABLE manager_queries (
    id INTEGER PRIMARY KEY,
    manager_id INTEGER REFERENCES site_managers(id),
    query_type VARCHAR(20), -- 'single' or 'multiple'
    worker_ids JSON,
    question TEXT NOT NULL,
    answer TEXT,
    context_used JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## File Structure

```
voice-agent/
├── backend/
│   └── app/
│       ├── database/
│       │   └── models.py          # Updated with new models ✅
│       ├── services/
│       │   ├── __init__.py        # NEW ✅
│       │   ├── summarization.py   # NEW: Summary generation ✅
│       │   └── qa_service.py      # NEW: Q&A for managers ✅
│       ├── routers/
│       │   ├── __init__.py        # NEW ✅
│       │   ├── worker.py          # NEW: Worker endpoints ✅
│       │   └── manager.py         # NEW: Manager endpoints ✅
│       └── main.py                # Updated with new routes ✅
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── RoleSelector.js       # NEW: Role selection ✅
│       │   ├── WorkerInterface.js    # NEW: Worker UI ✅
│       │   └── ManagerDashboard.js   # NEW: Manager UI ✅
│       ├── services/
│       │   └── ConstructionApi.js    # NEW: API client ✅
│       ├── themes.css                # Updated with construction theme ✅
│       └── App.js                    # Updated with routing ✅
└── TODO.md                           # This file
```

---

## Progress Tracking

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Database | ✅ Complete | 100% |
| Phase 2: Services | ✅ Complete | 100% |
| Phase 3: API | ✅ Complete | 100% |
| Phase 4: Frontend | ✅ Complete | 100% |
| Phase 5: Testing | ⏳ Pending | 0% |

---

## How to Run

### Backend
```bash
cd voice-agent/backend
# Make sure Ollama is running with mistral model
ollama serve &
ollama pull mistral

# Install dependencies
pip install -r requirements.txt

# Run the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd voice-agent/frontend
npm install
npm start
```

### Access the Application
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

---

## Features

### For Site Workers
1. **Easy Login** - Enter employee ID to log in or register
2. **Voice Updates** - Record daily updates using voice
3. **Automatic Summarization** - Updates are automatically summarized
4. **Update History** - View past updates and summaries

### For Site Managers
1. **Daily Summary** - View aggregated summary of all worker updates
2. **Filter by Date/Site** - Focus on specific dates or locations
3. **Single Worker Q&A** - Ask questions about a specific worker's updates
4. **Multi-Worker Q&A** - Ask questions across multiple workers
5. **Audio Playback** - Listen to summaries via text-to-speech

---

## Notes
- Using existing Whisper STT for voice-to-text
- Using existing Ollama/Mistral for summarization and Q&A
- Using existing Piper TTS for reading summaries aloud
- SQLite database for persistence
- All processing remains local (privacy-focused)
