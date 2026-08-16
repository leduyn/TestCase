# TestCase

Full-stack AI Test Case Generator and Management System

## Overview

This project is a full-stack application for generating and managing AI test cases. It consists of a Node.js/Express backend server and a React frontend client.

## Architecture

- **Server** (`server/`): Node.js/Express API with Prisma ORM
- **Client** (`client/`): React frontend application

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- PostgreSQL database

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy `.env.example` to `.env` and set your database URL and other configuration.

3. **Database setup:**

   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

   This starts both the server (port 3000) and client (port 3001) concurrently.

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start the application using PowerShell startup script |
| `npm run dev` | Start both server and client in development mode |
| `npm run server:dev` | Start only the server |
| `npm run client:dev` | Start only the client |
| `npm run build` | Build both server and client |
| `npm run kill` | Kill processes occupying ports |
| `npm run clean` | Clean build artifacts |

## Project Structure

```
.
├── client/           # React frontend
├── server/           # Node.js/Express backend
├── scripts/          # Helper scripts
├── Docs/             # Documentation
├── __pycache__/      # Python cache
└── node_modules/     # Dependencies
```

## Tech Stack

- **Frontend**: React, Vite
- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL
- **Utilities**: concurrently, dotenv

## License

MIT