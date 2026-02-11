---
name: Fix scoring display bug
overview: Fix the bug where correct answers show 0 points by including updated player scores in the round:end broadcast and fixing the display logic to show round-specific scores.
todos:
  - id: broadcast-scores
    content: Include updated player scores and per-player round scores in round:end broadcast (game-manager.ts endRound)
    status: completed
  - id: reducer-scores
    content: Update ROUND_END in use-game-state.ts to accept and store players + roundScores
    status: completed
  - id: display-fix
    content: Fix play/[gameCode]/page.tsx to show round score from roundScores map
    status: completed
isProject: false
---

# Fix: Correct Answers Showing 0 Points

## Problem

Two issues combine to cause this bug:

1. **Stale player data**: The `round:end` broadcast only sends `correctOptionId`, `answerDistribution`, `totalAnswers`. It does NOT include updated player scores. The client's `gs.players` array still has pre-answer scores.
2. **Wrong score reference**: The player page uses `myPlayerData?.totalScore` (cumulative total) instead of the round-specific score.

## Fix

### 1. Include player scores in `round:end` broadcast

In `[lib/game-manager.ts](lib/game-manager.ts)` `endRound()` (around line 270):

- After computing answer distribution, also fetch all players' updated `total_score`
- Fetch per-player round scores from the `answers` table for the current question
- Include both `players` (updated totals) and `roundScores` (map of playerId -> roundScore) in the broadcast payload

### 2. Update the reducer to handle new payload

In `[hooks/use-game-state.ts](hooks/use-game-state.ts)`:

- Extend the `ROUND_END` action payload type to include optional `players` and `roundScores`
- In the `ROUND_END` case, if `players` is present, update `gameState.players`
- Store `roundScores` in state so the player page can read it

### 3. Fix score display on player page

In `[app/play/[gameCode]/page.tsx](app/play/[gameCode]/page.tsx)` (line ~236):

- Instead of `myPlayerData?.totalScore`, look up the player's round score from `state.roundEndData.roundScores[playerId]`
