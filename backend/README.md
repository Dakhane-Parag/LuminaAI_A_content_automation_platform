# Brandflow AI — Backend API

> AI-powered Instagram Content Automation Platform  
> **Phase 1** — Foundation: Authentication & MongoDB Integration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.111 |
| Database | MongoDB + Motor (async) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Validation | Pydantic v2 |
| Config | Pydantic Settings + python-dotenv |
| Server | Uvicorn |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py                  # App factory + lifespan manager
│   ├── config/
│   │   └── settings.py          # Pydantic Settings (env-driven config)
│   ├── database/
│   │   └── connection.py        # Motor client + get_database() dependency
│   ├── models/
│   │   └── user.py              # MongoDB document shape (UserDocument)
│   ├── schemas/
│   │   └── user.py              # Pydantic I/O schemas (UserCreate, UserResponse…)
│   ├── services/
│   │   └── user_service.py      # Business logic (no HTTP concerns)
│   ├── routes/
│   │   ├── __init__.py          # Central router aggregation
│   │   ├── auth.py              # /register, /login, /me
│   │   └── health.py            # /health, /health/db
│   ├── utils/
│   │   └── security.py          # Password hashing + JWT creation/validation
│   └── dependencies/
│       └── auth.py              # get_current_user, get_current_active_user
├── requirements.txt
├── .env                         # ← your secrets (never commit)
├── .env.example                 # ← template for onboarding
└── README.md
```

---

## Quick Start

### 1 — Prerequisites

- Python 3.11+
- MongoDB running locally on port `27017`  
  (Install from https://www.mongodb.com/try/download/community)

### 2 — Clone & enter the backend directory

```powershell
cd "backend"
```

### 3 — Create and activate a virtual environment

```powershell
# Create
python -m venv venv

# Activate (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Activate (Windows CMD)
.\venv\Scripts\activate.bat
```

### 4 — Install dependencies

```powershell
pip install -r requirements.txt
```

### 5 — Configure environment

The `.env` file is already pre-configured with development defaults.  
For production, generate a secure JWT secret:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Then update `JWT_SECRET_KEY` in your `.env`.

### 6 — Run the server

```powershell
# Development (with hot reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or via Python
python -m app.main
```

Server starts at: **http://localhost:8000**

---

## API Endpoints

### Root

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Welcome message + links |

### Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | ❌ | App liveness check |
| GET | `/api/v1/health/db` | ❌ | MongoDB connectivity + stats |

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | ❌ | Register a new account |
| POST | `/api/v1/auth/login` | ❌ | Login and receive JWT |
| GET | `/api/v1/auth/me` | ✅ Bearer | Get current user profile |

---

## Testing with Swagger UI

1. Open **http://localhost:8000/docs** in your browser
2. You'll see all endpoints with interactive forms

### Register a user

- Click `POST /api/v1/auth/register` → **Try it out**
- Body:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```

### Login

- Click `POST /api/v1/auth/login` → **Try it out**
- Body:
```json
{
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```
- Copy the `access_token` from the response.

### Use protected routes

1. Click the **🔒 Authorize** button (top right of Swagger)
2. Paste your `access_token` in the **Value** field
3. Click **Authorize** → **Close**
4. Now call `GET /api/v1/auth/me` → **Try it out** → **Execute**

---

## Password Policy

| Rule | Requirement |
|------|-------------|
| Minimum length | 8 characters |
| Uppercase | At least 1 |
| Lowercase | At least 1 |
| Digit | At least 1 |

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `Brandflow AI` | Application display name |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `DEBUG` | `True` | Enables hot-reload and verbose logs |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `brandflow_ai` | Database name |
| `JWT_SECRET_KEY` | *(required)* | Secret used to sign JWT tokens |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token lifetime in minutes |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |
| `BCRYPT_ROUNDS` | `12` | bcrypt work factor (higher = slower + safer) |

---

## Security Notes

- Passwords are hashed with **bcrypt** — plaintext is never stored
- JWT tokens are signed with **HS256** and expire after 30 minutes
- Authentication uses **timing-safe** password comparison (prevents email enumeration)
- Email addresses are **normalised to lowercase** before storage/lookup
- The `/me` endpoint checks the **is_active** flag — deactivated accounts are blocked

---

## Next Phases

- **Phase 2** — Instagram API Integration & Content Generation
- **Phase 3** — AI-powered Caption & Hashtag Engine
- **Phase 4** — Scheduling & Publishing Pipeline
- **Phase 5** — Analytics & Performance Dashboard
