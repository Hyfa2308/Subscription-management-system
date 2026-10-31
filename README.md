# REVORA
## Subscription Management & Revenue Intelligence Platform

> **Manage subscriptions. Automate billing. Predict risks. Protect revenue.**

REVORA is a professional, full-stack subscription management and revenue intelligence platform built for **Brightloop Software**. It manages the complete subscription lifecycle — from customer registration and product configuration through recurring billing, invoicing, payments, churn prediction, and AI-driven revenue recovery.

---

## Project Objectives

- Provide a unified platform for managing SaaS subscription operations
- Automate recurring billing and invoice generation
- Deliver intelligent churn-risk identification and revenue forecasting
- Enable proactive payment recovery through an AI-powered Revenue Rescue Center
- Integrate with Odoo (optional) as the authoritative financial record system

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite 5 | Build tool and dev server |
| Tailwind CSS 3 | Utility-first styling |
| shadcn/ui + Radix UI | Accessible component primitives |
| React Router DOM v6 | Client-side routing |
| Recharts | Data visualisation |
| React Hook Form + Zod | Forms and validation |
| Axios | HTTP client |
| Lucide React | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.14 | Runtime |
| FastAPI | REST API framework |
| SQLAlchemy 2 | ORM |
| Alembic | Database migrations |
| Pydantic v2 | Data validation and settings |
| python-jose + passlib | JWT authentication |
| SQLite | Local development database |
| PostgreSQL | Production database |

---

## Architecture Overview

```
REVORA/
├── frontend/           React + Vite frontend application
│   └── src/
│       ├── components/ Reusable UI components
│       │   ├── common/ Shared utilities (ConnectionStatusBadge, etc.)
│       │   └── layout/ Sidebar, Topbar
│       ├── config/     App constants, route definitions
│       ├── context/    React context providers
│       ├── hooks/      Custom React hooks
│       ├── layouts/    AppLayout shell
│       ├── pages/      Page-level components
│       ├── services/   API client, health service
│       ├── types/      TypeScript type definitions
│       └── utils/      Utility functions (cn, formatters)
│
└── backend/            FastAPI Python backend
    ├── app/
    │   ├── api/v1/     REST endpoints (versioned)
    │   ├── core/       Config, security, exception handlers
    │   ├── database/   SQLAlchemy engine and session
    │   ├── integrations/ Odoo adapter interface + XML-RPC impl
    │   ├── models/     SQLAlchemy ORM models
    │   ├── repositories/ Data access layer
    │   ├── schemas/    Pydantic request/response schemas
    │   ├── services/   Business logic
    │   └── utils/      Shared utilities
    ├── alembic/        Database migration files
    └── tests/          pytest test suite
```

---

## Prerequisites

- **Node.js** ≥ 20 and **npm** ≥ 10
- **Python** ≥ 3.11 (tested on 3.14)
- **Git**
- PostgreSQL (optional; SQLite used by default for local development)

---

## Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd Subscription-management-system
```

### 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate       # macOS / Linux
# .venv\Scripts\activate        # Windows

# Install dependencies
pip install pydantic pydantic-settings --pre --upgrade  # Python 3.14 compatibility
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env as needed (defaults work for local SQLite development)
```

### 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit VITE_API_BASE_URL if backend runs on a different port
```

---

## Environment Configuration

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | _(empty → SQLite)_ | PostgreSQL URL or leave empty |
| `SQLITE_PATH` | `./revora_dev.db` | SQLite database file path |
| `SECRET_KEY` | `CHANGE_ME_IN_PRODUCTION` | JWT signing key |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token lifetime |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | CORS allowed origins |
| `ODOO_ENABLED` | `false` | Enable Odoo integration |
| `ODOO_URL` | `http://localhost:8069` | Odoo server URL |
| `ODOO_DB` | `odoo` | Odoo database name |
| `ODOO_USERNAME` | `admin` | Odoo login username |
| `ODOO_PASSWORD` | `admin` | Odoo login password |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Database Setup

### SQLite (local development — default)

No setup required. The database file `revora_dev.db` is created automatically on first run.

### PostgreSQL (production)

```bash
# Create database
createdb revora

# Set DATABASE_URL in backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/revora

# Run migrations
cd backend
source .venv/bin/activate
alembic upgrade head
```

---

## Running the Application

### Start the backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

The backend starts at: **http://localhost:8000**

### Start the frontend

```bash
cd frontend
npm run dev
```

The frontend starts at: **http://localhost:5173**

---

## API Health Check

```bash
curl http://localhost:8000/api/v1/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "REVORA backend is running",
  "version": "1.0.0",
  "environment": "development",
  "timestamp": "2026-10-31T04:34:09.389579+00:00",
  "database": "connected"
}
```

Interactive API documentation: **http://localhost:8000/docs**

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

---

## Development Roadmap

| Phase | Module | Status |
|---|---|---|
| 1 | Foundation & Setup | ✅ Complete |
| 2 | Customer Management | 🔜 Next |
| 3 | Products & Plans | Pending |
| 4 | Subscription Lifecycle | Pending |
| 5 | Invoicing & Billing | Pending |
| 6 | Payment Processing | Pending |
| 7 | Revenue Intelligence & AI | Pending |

---

## Security Notes

- Never commit `.env` files (covered by `.gitignore`)
- Change `SECRET_KEY` before any deployment
- Odoo credentials are backend-only — never exposed to the frontend
- All environment files are excluded from version control

---

## Contributing

This is a hackathon project. Branch per feature, use descriptive commit messages, and keep modules independent.

---

*Built for the Brightloop Software hackathon. REVORA — Manage subscriptions. Automate billing. Predict risks. Protect revenue.*