# Unity Art Collective: Creative Playground (showcase)

> **Status: Work in progress.** This is a public showcase of the [Unity Art Collective](https://unitycollective.art) web platform, not the full site source.

Unity Art Collective is an arts and education platform built by Levi Howze (Army Captain turned finance and risk leader) with AI coding tools. It combines a public site, a creator marketplace and a "Creative Playground" of hands-on browser tools for music, poetry, games and visual arts, offered to schools and members.

This repository contains one complete, self-contained tool from the playground (the VOLT step-sequencer drum machine) plus screenshots of public pages.

## Why it matters

- **Ship small, safe and testable.** Each playground tool is a static page with a strict Content-Security-Policy (`connect-src 'none'`): no network calls, no accounts, no uploads, no tracking. Data stays in the visitor's browser and can be erased in one click.
- **Built for classrooms and shared devices.** Sound only starts on an explicit tap, volume starts low, and the whole tool is keyboard- and screen-reader-operable.
- **Release discipline.** Changes ship as explicit file lists with backup and rollback after owner approval, never whole-tree syncs.

## What's here

| Path | What |
|---|---|
| `music-studio/` | Music Studio landing page and shared CSS |
| `music-studio/volt/` | VOLT: 4 tracks x 16 steps, tempo and swing, mute, rhythm style presets, local-only save (`model.js` state, `audio.js` Web Audio scheduler, `app.js` UI) |
| `tests/` | 23 deterministic Node tests with a fake Web Audio context (state, scheduling, interruption handling, style loading) |
| `docs/screenshots/` | Public pages: Creative Playground, Marquee Booth photo kiosk, Physics of Balls and Blocks, Drum Machine |

Note: the Drum Machine screenshot shows the current live version, which has more features than the VOLT version in this repository.

## Run it

```bash
python3 -m http.server 8000      # then open http://localhost:8000/music-studio/
node --test tests/volt.test.mjs tests/volt-output.test.mjs tests/volt-styles.test.mjs
```

## Tech stack (platform)

Static HTML, CSS and vanilla JavaScript modules (Web Audio, browser 3D) on the front end; Python back end for creators, marketplace and membership. Only the front-end tool above is published here.

## Intentionally omitted (security and privacy)

- All back-end code (accounts, sign-in and sessions, payments, marketplace, admin tools), database schemas and server configuration.
- Hosting, deployment and infrastructure details, and git history.
- All media of people, student and creator content, customer data, contact numbers and logs.
- Unreleased or draft pages.

## Rights

All rights reserved by Unity Art Collective. No open-source license is granted.
