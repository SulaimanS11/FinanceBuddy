# Securities RAG Tutor

A Retrieval-Augmented Generation system for securities education using Google Gemini 2.0 Flash.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

3. Build the project:
```bash
npm run build
```

4. Run tests:
```bash
npm test
```

5. Start development server:
```bash
npm run dev
```

## Project Structure

- `src/models/` - TypeScript interfaces and data models
- `src/services/` - Business logic and external service integrations
- `src/api/` - REST API routes and middleware
- `src/ui/` - React components for the web interface
- `src/test/` - Test utilities and setup

## Requirements

- Node.js 18+
- TypeScript 5+
- Google Gemini API key
- Vector database (Chroma)