# Deploy Questbound on Vercel

The repository is configured for Vite, Node.js 24, `npm ci`, `npm run build`, and the `dist` output folder. No environment variables or API keys are needed.

## GitHub to Vercel

1. Push this repository to your GitHub account.
2. In Vercel, choose Add New Project and import the GitHub repository.
3. Select the intended personal/team account and keep the repository root as the Root Directory.
4. Keep the settings from vercel.json and deploy.
5. Verify both the opening page and /play.html, plus PDF/Word import and a two-hit finishing strike.

Future pushes to the connected production branch can trigger Vercel deployments. The game uses two HTML entry points; do not add an SPA rewrite that sends /play.html to index.html.

## Local use

Install Node.js 24, run `npm ci`, then `npm start`. On Windows, Start Game.cmd opens the game after dependencies are installed.

## Progress transfer

Localhost and the Vercel domain have separate browser storage. Use Back up quests locally and Import quests on the hosted site to transfer assignments and progress. Assignment file extraction happens in the browser.

## Credits

The Ourcade MIT license and artwork credits remain included. The repository contains the original assignment and combat additions plus the licensed starter foundation.
