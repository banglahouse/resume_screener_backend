# Resume Matcher Backend

Backend service for resume vs. job-description matching, RAG-powered chat, and recruiter/candidate workflows. This document covers the system architecture, setup instructions, and API reference so the frontend team can integrate quickly.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Setup & Configuration](#setup--configuration)
4. [Project Commands](#project-commands)
5. [API Reference](#api-reference)
6. [Error Handling](#error-handling)
7. [Development Notes](#development-notes)

## Architecture Overview

### High-Level Components
- **Clients**: Web UI or API consumers sending uploads and chat requests.
- **Express/TypeScript API**: Routes + controllers for recruiters and candidates.
- **Services**: `ApplicationService` handles parsing, chunking, embeddings, persistence; `ChatService` performs RAG chat.
- **Database**: PostgreSQL + pgvector store users, jobs, applications, and embeddings.
- **OpenAI**: Provides embeddings and chat completions.

```mermaid
flowchart LR
  Client[Web Client / SDK]
  Client -->|HTTP + Auth Headers| API[Express Router]
  API --> Controllers
  Controllers --> Services
  Services -->|SQL/Vector Ops| DB[(PostgreSQL + pgvector)]
  Services -->|Embeddings & Chat| OpenAI[(OpenAI APIs)]
```

### Request Lifecycle (Example: Create Application)
```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Service
  participant DB
  participant OpenAI
  UI->>API: POST /api/applications (files + form-data)
  API->>Service: createApplication(dto, user)
  Service->>OpenAI: embedMany(jd/resume chunks)
  Service->>DB: save job/resume chunks + application
  Service-->>API: application summary + match details
  API-->>UI: 201 Created JSON response
```

## Tech Stack
- **Runtime**: Node.js 18+, TypeScript.
- **Frameworks/Libraries**: Express, TypeORM, Multer, pg/pgvector, OpenAI SDK.
- **Tooling**: ts-node-dev, ts-node, TypeScript compiler.

## Setup & Configuration

### Prerequisites
1. Node.js 18+
2. PostgreSQL 15+ with [pgvector](https://github.com/pgvector/pgvector) and `uuid-ossp` extensions installed.
3. OpenAI API key (for embeddings + chat completions).

### Installation Steps
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Environment file**
   ```bash
   cp .env.example .env
   # Edit .env (see variables below)
   ```
3. **Configure environment variables** (minimum)
   - `DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB`
   - `OPENAI_API_KEY=sk-...`
   - Optional: `PORT` (defaults 3000), `OPENAI_EMBEDDING_MODEL` (defaults `text-embedding-3-small`).
4. **Database migrations**
   ```bash
   npm run migration:run
   ```
5. **Run in development**
   ```bash
   npm run dev
   ```
6. **Build + start (production)**
   ```bash
   npm run build
   npm start
   ```

## Project Commands
| Command | Description |
| --- | --- |
| `npm run dev` | ts-node-dev watch mode server. |
| `npm run build` | Compile TypeScript into `dist/`. |
| `npm start` | Run compiled server from `dist/`. |
| `npm run migration:run` | Execute pending TypeORM migrations (uses `NODE_ENV` to pick migration glob). |
| `npm run migration:generate -- <Name>` | Generate a migration file in `migrations/`. |
| `npm run typecheck` | TypeScript type checking without emitting JS. |

## API Reference
_All endpoints return JSON responses unless noted. File uploads use `multipart/form-data`._

### Authentication
Request headers:
- `x-user-id`: External identifier for recruiter/candidate (optional; defaults to anonymous recruiter if missing).
- `x-user-role`: `recruiter` or `candidate` (defaults to `recruiter` when missing/invalid).

### Recruiter Endpoints

#### `POST /api/applications`
Create an application by uploading resume & JD.
- **Headers**: `x-user-id`, `x-user-role: recruiter`
- **Body** (`multipart/form-data`):
  - `jobKey` (string, required)
  - `jobTitle` (string, optional)
  - `candidateUserId` (string, required)
  - `jdFile` (PDF/TXT, required)
  - `resumeFile` (PDF/TXT, required)
- **Success 201**
  ```json
  {
    "applicationId": "uuid",
    "jobId": "uuid",
    "match": {
      "score": 82.5,
      "strengths": [
        "5y React",
        "BS Computer Science"
      ],
      "gaps": [
        "No Kubernetes"
      ],
      "insights": [
        "Strong backend architecture focus"
      ]
    }
  }
  ```
- **Errors**
  - `400` Missing fields or files
  - `403` Unauthorized role
  - `415/422` Unsupported file type or insufficient text
  - `500` Parsing/embedding/database error

#### `GET /api/applications/:applicationId`
Fetch application + match summary.
- Recruiter owner or candidate owner may access.
- **Response 200**
  ```json
  {
    "applicationId": "uuid",
    "jobKey": "ENG-234",
    "jobTitle": "Backend Engineer",
    "match": {
      "score": 78,
      "strengths": [],
      "gaps": [],
      "insights": []
    },
    "createdAt": "2025-11-30T12:15:00.000Z"
  }
  ```
- Errors: `403` when user lacks access, `404` when not found.

#### `GET /api/jobs/:jobKey/applications`
List applications for a job (recruiter only). Returns array of the same objects as `GET /api/applications/:id`.

#### `POST /api/applications/:applicationId/chat`
Ask a question about an application. Body:
```json
{ "message": "Does the candidate have Kubernetes experience?" }
```
Response contains the assistant message plus metadata:
```json
{
  "id": "uuid",
  "applicationId": "uuid",
  "role": "assistant",
  "content": "The resume does not mention Kubernetes experience.",
  "createdAt": "2025-11-30T12:20:00.000Z"
}
```
Errors: `400` invalid body, `403/404` access, `500` when chat/embedding fails.

#### `GET /api/applications/:applicationId/chats?limit=50&offset=0`
Returns paginated chat history:
```json
{
  "messages": [
    { "id": "uuid", "role": "user", "content": "...", "createdAt": "..." },
    { "id": "uuid", "role": "assistant", "content": "...", "createdAt": "..." }
  ],
  "limit": 50,
  "offset": 0,
  "total": 12
}
```

### Candidate Endpoints
Candidates reuse recruiter endpoints but only for their own applications:
- `GET /api/applications/:id`
- `POST /api/applications/:id/chat`
- `GET /api/applications/:id/chats`

### File Upload Notes
- Accepted mimetypes: PDF (`application/pdf`) and plain text (`text/plain`).
- Multer stores uploads in memory (10MB limit). Adjust `recruiter.routes.ts` if needed.

## Error Handling
- Operational errors raised via `AppError` return `{ "message": string, "statusCode": number }`.
- Unhandled errors log via `utils/logger` and respond with `500` + generic message.
- Authentication middleware auto-creates users when headers are omitted; override with explicit IDs/roles.

## Development Notes
- **Migrations**: `src/config/data-source.ts` selects migration glob based on `NODE_ENV`. Development uses TypeScript files (`migrations/*.ts`); production uses compiled files under `dist/migrations`.
- **Type Safety**: `npm run typecheck` before commits.
- **OpenAI Usage**: `ChatService` embeds queries/context using `OPENAI_EMBEDDING_MODEL` and `OPENAI_API_KEY`.
- **Logging**: JSON structured logs via `utils/logger`. Search logs for timestamps/request IDs when debugging.

For frontend integration, ensure all API calls include the headers and handle upload + chat workflows detailed above.
