# GitHub Scanner

Backend service for scanning GitHub repositories and analyzing issues using LLM.

## Features

- **Scan**: Fetch and cache open GitHub issues from any repository
- **Analyze**: Use LLM to analyze cached issues with custom prompts
- **Configurable Limits**: Control scan size and LLM context window via environment variables

## Storage Choice

This project uses SQLite for persistent storage of cached GitHub issues. Here's why:

| Attribute                     | In-Memory Storage | JSON File Storage | SQLite (chosen)           |
| ----------------------------- | ----------------- | ----------------- | ------------------------- |
| Persistence across restarts   | ❌ No              | ✅ Yes             | ✅ Yes                     |
| Setup complexity              | ✅ Very low        | ✅ Low             | ◑ Moderate                |
| Data integrity & atomicity    | ❌ None            | ❌ Manual          | ✅ Built-in (ACID)         |
| Concurrency safety            | ❌ No              | ❌ No              | ✅ Yes                     |
| Querying & filtering          | ❌ Very limited    | ❌ Manual          | ✅ Native SQL              |
| Idempotent updates            | ❌ Hard            | ◑ Possible        | ✅ Easy (UPSERT)           |
| Scalability (issue count)     | ❌ Poor            | ◑ Degrades        | ✅ Good                    |
| Operational overhead          | ✅ None            | ✅ Minimal         | ✅ Minimal (single file)   |
| Suitability for caching       | ❌ Weak            | ◑ Acceptable      | ✅ Strong                  |
| Interview / production signal | ❌ Toy             | ◑ Script-level    | ✅ Serious but lightweight |

**Key Benefits:**

* **Durable by default**: Cached GitHub issues persist across server restarts, making the `/analyze` endpoint reliable and demo-safe.

* **Correctness with minimal complexity**: SQLite provides transactions, constraints, and atomic operations out of the box, ensuring data integrity without manual synchronization logic.

## Prerequisites

- Node.js 18+ (for local development)
- Python 3.7+ (for CLI tool, optional)
- Docker & Docker Compose (for containerized deployment)
- OpenAI API key (for analysis features)

## Quick Start

### With Docker Compose

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY
   ```

2. **Start the service:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the service:**
   ```bash
   docker-compose down
   ```

The API will be available at `http://localhost:3000`

### Without Docker (Local Development)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env and set OPENAI_API_KEY
   ```

3. **Build TypeScript:**
   ```bash
   npm run build
   ```

4. **Start the server:**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

## Environment Variables

See `.env.example` for all available options. Required:

- `OPENAI_API_KEY` - Your OpenAI API key (required for analysis)

Optional:
- `PORT` - Server port (default: 3000)
- `MAX_SCAN_ISSUES` - Limit number of issues fetched during scan
- `MAX_ANALYSIS_ISSUES` - Limit issues in LLM context (default: 50)
- `MAX_BODY_CHARS` - Truncate issue bodies to N chars (default: 1000)
- `MAX_TOTAL_CHARS` - Total character limit for analysis (default: 30000)

## Usage

### API Endpoints

**Scan a repository:**
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{"repo": "facebook/react"}'
```

**Analyze cached issues:**
```bash
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "facebook/react",
    "prompt": "What are the main bug categories?"
  }'
```

**Get cached issues:**
```bash
curl "http://localhost:3000/scan?repo=facebook/react"
```

### Python CLI (Optional)

For easier command-line usage:

```bash
# Scan a repository
python cmd/cli.py scan facebook/react

# Analyze issues
python cmd/cli.py analyze facebook/react "What are the top priorities?"
```

Set custom API URL:
```bash
API_BASE_URL=http://localhost:8080 python cmd/cli.py scan facebook/react
```
