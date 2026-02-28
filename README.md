# P23 Market (Nuxt 4)

Internal office betting ledger app for tracking player-to-player transfers and bank borrow/repay.

## Stack
- Nuxt 4
- Vue 3 + TypeScript (`<script setup lang="ts">`)
- Custom CSS (single theme file)

## Core Concept
- Currency unit: `M-coin`
- Exchange reference: `1 coin = 10 THB`
- Trust-based flow: no approval workflow
- Public visibility: players and leaderboard are visible to everyone

## Current Features
- Login/Register dialog with password
- Dashboard with game-style UI and match feed
- Players leaderboard (podium top-3 + rank table)
- Transfer page with quick amount buttons (`2, 5, 10, 15, 20`)
- Transactions page as card list
- Bank page (`P23-Bank`) with borrow/repay modes
- EN/TH localization

## Project Structure
- `pages/` route pages
- `layouts/default.vue` app shell, topbar, slideover, auth dialogs
- `composables/useMMarket.ts` mock state + business logic
- `composables/useLocale.ts` i18n messages and helpers
- `assets/css/main.css` global design system and page styles
- `public/images/m-coin.svg` coin asset
- `API.md` backend API planning document

## Local Development (Yarn)
```bash
yarn install
yarn dev
```

App default URL:
- `http://localhost:3000`

## Demo Accounts
Mock users are seeded in `useMMarket.ts`.

- Username examples: `banker`, `player1`, `player3`, `player4`
- Default password for seeded users: `1234`

## Notes
- This is currently frontend/mock-data driven (no real backend yet).
- Settlement stores snapshots in memory state.
- See `API.md` for suggested API contracts for backend integration.