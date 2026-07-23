# Custom Agent Rules for NTGold & NTPOS Projects

These rules apply to any AI Agent working in this repository.

## 1. Context Retention (Changelog Requirement)
**CRITICAL**: Every time you complete a task, fix a bug, or make any modifications to the codebase in this repository, you MUST update the relevant `CHANGELOG.md` file before finishing your turn.
- For the NTGold App, update `goldapp/docs/CHANGELOG.md`.
- For the NTPOS App, update `pos/docs/CHANGELOG.md`.
- Append your changes under a new date header (if it doesn't exist) or under the existing date.
- Use concise bullet points describing what files were changed and why.
- If you are starting a new session, your first step should be to read the relevant `CHANGELOG.md`, `TechStack.md`, and `Database_ERD.md` to gain context.

## 2. Directory Structure Awareness
Do not blindly search for files. Rely on the Directory Structure Map located in the respective `TechStack.md` (`goldapp/docs/TechStack.md` or `pos/docs/TechStack.md`) to quickly locate UI components, logic scripts, and serverless functions.

## 3. PWA Cache Versioning
**CRITICAL**: Both NTGold and NTPOS are Progressive Web Apps (PWA) with offline support. Every time you make changes to HTML, CSS, or JS files, you MUST update the `CACHE_NAME` version in the respective Service Worker file to ensure users receive the latest changes without stale cache issues.
- For NTGold App: Update `goldapp/sw.js` (e.g., `goldapp-v5` -> `goldapp-v6`).
- For NTPOS App: Update `pos/sw.js` (e.g., `pos-cache-v39` -> `pos-cache-v40`).
