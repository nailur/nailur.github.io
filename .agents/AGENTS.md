# Custom Agent Rules for NTGold Project

These rules apply to any AI Agent working in this repository.

## 1. Context Retention (Changelog Requirement)
**CRITICAL**: Every time you complete a task, fix a bug, or make any modifications to the codebase in this repository, you MUST update the `goldapp/docs/CHANGELOG.md` file before finishing your turn.
- Append your changes under a new date header (if it doesn't exist) or under the existing date.
- Use concise bullet points describing what files were changed and why.
- If you are starting a new session, your first step should be to read `goldapp/docs/CHANGELOG.md`, `goldapp/docs/TechStack.md`, and `goldapp/docs/Database_ERD.md` to gain context.

## 2. Directory Structure Awareness
Do not blindly search for files. Rely on the Directory Structure Map located in `goldapp/docs/TechStack.md` to quickly locate UI components, logic scripts, and serverless functions.
