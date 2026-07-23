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
