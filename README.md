# Swab (صواب)

> "Jouer franc jeu" — say what you want, to whom you want, without ever having to ask.

Swab is a mobile-first application that only reveals a desire if it's shared by the other side. The core principles are trust and transparency, with no gamification, no counters, and no silent filtering.

This project is developed using an **AI-Driven Development (AIDD)** methodology, where AI agents, guided by strict directives and architectural blueprints, perform a significant portion of the coding and maintenance tasks.

## ✨ Core Concepts

*   **Privacy First**: The user's relationship classification data (intimacy, roles, feelings, etc.) is the core of the product. This data exists **only** on the user's device, encrypted inside a "vault." The server stores this vault as an opaque, unreadable blob, ensuring that no one—not even us—can see how a user classifies their relationships.
*   **Transparent Matching**: When a user expresses a desire (*envie*), the scope of recipients is resolved on the client. The server only sees the final list of recipient IDs, never the rules or reasons for inclusion or exclusion. A match is only revealed to both parties simultaneously when their desires are compatible.
*   **AI-Driven Workflow**: Development follows a stage-gated pipeline (`Spec` → `Schema` → `Implement` → `Verify` → `Deploy`) managed by an orchestrator. AI agents are assigned specific roles and scopes (e.g., `area:api`, `area:mobile`) to work on features in parallel, with git acting as the central event bus.

## 🚀 Getting Started

Follow these steps to set up your local development environment.

### Prerequisites

*   Node.js (v20 or higher)
*   pnpm (v10.12.1 or higher)
*   Git
*   Neon CLI (for database branching)
*   Vercel CLI (for environment variables)

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd Swab
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

First, authenticate with Neon and Vercel:

```bash
neonctl auth
vercel login
```

Link your local project to Vercel (if you haven't already):

```bash
vercel link
```

Pull the environment variables from Vercel, which will create a `.env.local` file at the monorepo root. This file contains the `DATABASE_URL` for your development branch on Neon.

```bash
vercel env pull .env.local
```

### 4. Set up the database

Run the initial database migration to set up your schema on your Neon development branch.

```bash
pnpm db:migrate
```

## 🛠️ Development

This is a Turborepo monorepo. You can run commands from the root of the project.

*   **Run all apps in development mode**:
    ```bash
    pnpm dev
    ```

*   **Run tests**:
    ```bash
    pnpm test
    ```

*   **Run linter**:
    ```bash
    pnpm lint
    ```

*   **Build all packages and apps**:
    ```bash
    pnpm build
    ```