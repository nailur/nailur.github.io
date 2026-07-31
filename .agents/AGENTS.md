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

## 4. Token-Efficient Concise Responses
**CRITICAL**: To conserve tokens and maintain high efficiency, ALWAYS keep your responses concise, direct, and to the point.
- Provide the core answer, summary, or actionable next steps without unnecessary pleasantries, repetition, or fluff.
- Avoid re-summarizing large blocks of code or repeating context the user already knows.
- Focus strictly on the essence of the solution or findings.

## 5. Operational Hours Deployment Guard (NTPOS vs NTGold)
**CRITICAL**: Observe strict deployment schedules based on the application being modified:
- **NTPOS App (`pos/`)**: Do NOT execute `git push` during operational hours (**06:00 - 21:00 WIB / UTC+7**). During this window, all local commands are allowed, but do NOT push to production unless explicitly commanded by the user.
- **NTGold App (`goldapp/`)**: No operational restrictions. All commands, including `git push`, are allowed at any time.

## 6. Code Comment & Dead Code Cleanup
- Remove dead, unused, or commented-out code blocks immediately.
- Delete redundant or trivial comments/remarks.
- **EXCEPTION**: ALWAYS retain or add concise, informative comments for complex business logic, subtle edge cases, or special tricks to prevent future AI agents from misunderstanding the intent.

## 7. Ignore IDE Open Document Tabs
- Do NOT assume files currently open in the USER's IDE tabs are relevant to the request.
- Do NOT blindly inspect or read open tabs unless explicitly directed by the user or required by the specific task.
- Locate relevant files directly via `grep_search` or `TechStack.md` to conserve token usage.

## 8. English Code Identifiers, Comments & Documentation (Token Efficiency)
**CRITICAL**: To optimize token usage and reduce BPE tokenizer overhead:
- All function names, variable names, class/module identifiers, technical code comments, and **project documentation (`.md` files in `docs/` such as architecture, tech stack, business rules, changelogs, etc.)** MUST be written in **English**.
- Indonesian should ONLY be used for user-facing UI text, toast/confirm notifications, error messages displayed to end-users, and conversational prompts with the user.


