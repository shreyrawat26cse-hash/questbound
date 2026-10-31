# Questbound — Shrey Rawat, BMU

A browser game that turns assignment questions into a knight's adventure. Made by Shrey Rawat · BMU · shrey.rawat.26cse@bmu.edu.in.

## Start

Double-click **Start Game.cmd** to open the landing page at http://127.0.0.1:5173/. The server stays in the background after the launcher closes.

Choose **Build my adventure** to enter questions and correct answers, or drop an assignment file into the upload area. Review the generated levels and choose **Save assignment & play**. The game opens in its own window. **Try the maths quest** starts the built-in Sequences & Series assignment.

## File import

Supported files: **searchable PDF, DOCX, TXT, CSV and JSON**, up to 10 MB. PDFs may contain up to 30 pages. Each assignment supports 1–30 questions, with up to 10 independent saved assignments.

Files must include questions and correct final answers. Download the TXT sample from the opening page, or use `public/assignment-template.txt`, `.csv` or `.json`.

Text / Word / searchable PDF example:

```text
Q1: Find the next term: 3, 7, 11, 15.
Answer: 19
Hint: Add the common difference.

Q2: Find the sum of the first 20 positive integers.
Answer: 210
```

Numbered questions with a separate **Answer Key** section are also supported. CSV requires `question,answer` headers; optional `level_name,hint` columns are supported. JSON accepts `{ "title": "...", "questions": [{ "question": "...", "answer": "..." }] }` or an array of those entries.

No answers are guessed. Missing keys, unsupported files and invalid layouts produce a message without overwriting saved work. Scanned/image-only PDFs need OCR first; OCR is not included. Extraction happens in the browser. Always review imported question–answer pairs before playing.

## Controls

- **Arrows / WASD:** move.
- **Space / J (hold):** sword attack.
- **K or Shift:** jump. The button displays **Jump · K**.
- **E:** interact with a nearby chest or gate, otherwise climb.
- **F:** final blow when the guardian is staggered.
- **Q:** assignment question.
- On-screen controls provide the same movement, jump, attack, ladder and question actions.

Combat pauses while a question or menu is open. Closing it returns keyboard focus to the game. No document scrolling is needed in the game window. The ⛶ button enters fullscreen.

## Short fights and finishing strikes

Each room has a lower hall and an upper guardian. Ordinary lower-hall enemies fall in **two hits**. Hit the upper guardian or final boss **twice** to break its guard. It stops attacking and a small **Final blow · F** prompt appears.

Press F or click that prompt. The level's assignment question appears. A wrong answer keeps the enemy staggered so you can retry. A correct answer triggers a short hero dash and one-strike sword-finisher animation. If you answered the question earlier, the prompt lets you deliver the finisher directly.

After the finishing strike, walk to or click the gate to enter the next level. Finishing the final Warden rescues the queen and awards the completion honors. There is no eight-hit shield grind.

The demo uses lizard, slime, bat, skeleton, imp and spider creatures. Types cycle for longer assignments. Jump over crates and spike traps. If defeated, Retry encounter restores health and keeps verified assignment work.

## Chests and progress

Each floor has a chest with an optional arithmetic riddle. A correct answer opens it, awards **25 XP and up to 2 health**, once only. Bonus answers do not overwrite assignment answers or affect first-attempt honors.

Correct assignment answers give 100 XP. Badges include Oath of the First Knight, Guardian of Wisdom, Honor of the Proudest Knight and The Flawless Crown. Rescue honors require all questions and battles complete. The Flawless Crown also requires each assignment question correct on its first nonempty submission.

Assignments, answers, cleared rooms and claimed treasure save in browser storage. Clearing browser data removes them. Mid-battle positions and health are not saved. Editing names/hints preserves progress; changing questions or keys resets that assignment. An old game window cannot overwrite a newer assignment definition saved from the landing page.

## Export and deployment

Landing **Back up quests** downloads all slots, keys and progress as JSON. **Import quests** restores valid backup slots without replacing existing ones. In-game Pause → **Export answers** creates printable HTML; open it and use Print / Save as PDF.

Run `npm.cmd run build` to produce a static `dist` folder containing both `index.html` and `play.html`. Deploy that folder as the website root. PDF/Word readers are bundled; no API key or backend is required. See DEPLOYMENT.md. Local browser progress does not automatically transfer to a newly hosted domain; export a backup locally and import it on the hosted site.

Development checks: `npm.cmd run typecheck`, `npm.cmd test` (Microsoft Edge), `npm.cmd run build`.

## Attribution

Ourcade's Phaser 3 Dungeon Crawler Starter supplied the original foundation and animation code: https://github.com/ourcade/phaser3-dungeon-crawler-starter (MIT). Its full license remains in LICENSE and the credits page. Original artwork: Dungeon Tileset II by 0x72 and Legend of Faune by ansimuz, published as CC0. New creatures, Warden, queen, sword effects, ladder, obstacles and opening illustration are drawn in code.

PDF text extraction uses Mozilla PDF.js (Apache-2.0). Word text extraction uses Mammoth (BSD-2-Clause). Their licenses are retained in dependencies and generated bundle notices.
