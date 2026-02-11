# Trivia Game

Real-time multiplayer trivia game (Kahoot-style) built with Next.js 16, React 19, and Tailwind CSS v4.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. **Host** creates a game at `/host/create` — sets a host PIN, game password, teams, and uploads a questions JSON file
2. **Host** receives a 6-character game code and is redirected to the dashboard at `/host/[code]`
3. **Players** join at `/play/[code]` — enter the game password, a display name, and select a team
4. **Host** controls the game flow: Start Game → Next Round → End Round → Show Results → End Game
5. Players answer questions in real-time, scored on correctness and speed

## Question JSON Format

Upload a JSON file when creating a game. The file should follow this schema:

```json
{
  "title": "My Trivia Game",
  "questions": [
    {
      "text": "What is the capital of France?",
      "options": [
        { "id": "a", "text": "London" },
        { "id": "b", "text": "Paris" },
        { "id": "c", "text": "Berlin" },
        { "id": "d", "text": "Madrid" }
      ],
      "correctOptionId": "b",
      "timeLimit": 20
    }
  ]
}
```

Each question requires:

- `text` — the question text
- `options` — exactly 4 options, each with `id` and `text`
- `correctOptionId` — the `id` of the correct option
- `timeLimit` — seconds for the round (5–120)

A sample file is provided at `data/sample-questions.json`.

## Scoring

- Correct answer: `Score = 1 × (1 - time_taken / time_limit)`
- Incorrect/no answer: 0 points
- Team score: sum of all team members' individual scores

## Tech Stack

- **Next.js 16** with App Router and React Compiler
- **React 19** with Server-Sent Events for real-time updates
- **Tailwind CSS v4** with dark theme
- **lowdb** for local JSON file persistence
- No external database or deployment needed
