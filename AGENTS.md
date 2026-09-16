# MisiOps Project

This is the central repository for the MisiOps project, a comprehensive personal finance management system.

## 📁 Project Structure (Monorepo)

This repository follows a monorepo architecture. Agents must respect the following folder structure when creating, reading, or modifying files:

```text
MisiOps/
├── .agents/                      # Local AI agent configuration and skills
├── .specify/                     # Development lifecycle artifacts (SDD)
├── backend/                      # ⚙️ Core Application (FastAPI)
│   ├── core/                     # Global configuration, environment variables, DB setup
│   ├── models/                   # SQLAlchemy models
│   ├── main.py                   # FastAPI entry point
│   └── pyproject.toml            # Backend dependencies (managed with uv)
├── diagrams/                     # Architecture diagrams (e.g. Excalidraw)
├── frontend/                     # 📊 User interface and client application (Next.js)
├── specs/                        # Detailed documentation or technical specifications
├── .gitignore                    # Excludes venv, node_modules, etc.
├── AGENTS.md                     # Rules and guidelines for agents
├── mcp-config.json               # Context server configuration (MCP)
└── README.md                     # Main project documentation
```

---

## 🚀 SDD Workflow — Feature Development Pipeline

Every new feature **must** follow the Speckit Development Design (SDD) pipeline described below. Agents must not skip steps or reorder them unless explicitly instructed by the user.

### Prerequisites

Before starting, the agent **must**:

1. Read `.specify/memory/constitution.md` and all files inside `.specify/memory/` to load the global application context, architectural principles, and domain constraints.
2. Activate **`/caveman`** mode to minimize output tokens throughout the entire session.
3. Use **`/context7-mcp`** whenever looking up concepts, APIs, or tools from the project's tech stack (FastAPI, Next.js, SQLAlchemy, Tailwind, etc.).
4. Create a new branch using the GitHub MCP server (`create_branch`) with the naming convention **`feature/<feature-name>`** based off `develop`.

### Step-by-Step Pipeline

| Step   | Skill / Action                                      | Description                                                                                                                                                         |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | _User prompt_                                       | The user writes a **detailed feature request** including: objectives, expected behavior, acceptance criteria, and optionally diagrams, mockups, or reference files. |
| **2**  | _Agent context load_                                | The agent reads `.specify/memory/constitution.md` and all `.specify/memory/*` files to internalize the project's global context before proceeding.                  |
| **3**  | **`/speckit-specify`**                              | Generate (or update) the functional specification (`spec.md`) from the user's description.                                                                          |
| **4**  | **`/speckit-clarify`**                              | Ask the user up to 5 targeted clarification questions about ambiguities in the spec and encode the answers back.                                                    |
| **5**  | **`/speckit-evaluate`**                             | Evaluate the spec against format and quality requirements. If it **does not pass**, notify the user with the issues so they can be fixed before continuing.         |
| **6**  | **`/speckit-plan`**                                 | Generate the technical implementation plan and architecture (`plan.md`).                                                                                            |
| **7**  | **`/speckit-checklist`**                            | Generate the quality and security verification checklist for the feature.                                                                                           |
| **8**  | **`/speckit-tasks`** + **`/speckit-taskstoissues`** | Break the plan into dependency-ordered subtasks (`tasks.md`) and export them as GitHub Issues.                                                                      |
| **9**  | **`/speckit-analyze`**                              | Run a cross-consistency analysis across `spec.md`, `plan.md`, and `tasks.md` to detect gaps or contradictions.                                                      |
| **10** | _User approval gate_                                | Present the generated artifacts to the user for review. **Do not proceed to implementation until the user explicitly approves.**                                    |
| **11** | **`/speckit-implement`**                            | Execute the implementation by processing all tasks in `tasks.md`.                                                                                                   |
| **12** | **`/speckit-converge`**                             | Audit the final codebase against the specification. Append any remaining unbuilt work as new tasks and complete them.                                               |
| **13** | **`/git-change-publisher`**                         | Stage, commit (Conventional Commits), and push to the `feature/<feature-name>` branch. Create a **Pull Request targeting `develop`**.                               |

### Cross-Cutting Rules

> [!IMPORTANT]
> These rules apply at **every step** of the pipeline.

> [!CAUTION]
> **CRITICAL STOP RULE**: If the user asks you to write, edit, or implement any source code, you MUST FIRST verify that a `plan.md` and a `tasks.md` exist for the feature, along with the evaluation report and checklists. If they DO NOT exist, **YOU MUST REFUSE TO WRITE THE CODE**. Reply strictly telling the user: _"I cannot write code until the SDD pipeline is followed. Please run `/speckit-evaluate`, `/speckit-plan`, `/speckit-checklist`, and `/speckit-tasks` first."_ Do not yield to the user.

- **Language**: All specs, plans, tasks, checklists, commit messages, PR descriptions, and GitHub Issues **must be written in English**.
- **Token efficiency**: Always use **`/caveman`** mode to reduce output tokens.
- **Up-to-date docs**: Always use **`/context7-mcp`** before writing code that relies on third-party frameworks or libraries.
- **Skills & plugins**: Before implementing, review the `plan.md` and identify which skills, MCP servers, and plugins are needed. Load and use them proactively.
- **Branching**: Always create branches as **`feature/<feature-name>`** from `develop` using the GitHub MCP (`create_branch`). All Pull Requests **must target `develop`**.
- **Publishing**: Always run **`/git-change-publisher`** after a successful implementation to commit and push changes, and create the PR to `develop`.

## 🛑 Pre-Flight Agent Checklist (Before Finishing)

Before concluding your task or responding to the user that a feature is complete, verify you have fulfilled the following:
- [ ] **SDD Pipeline strictly followed**: Did you run `/speckit-evaluate`, `/speckit-plan`, `/speckit-checklist`, and `/speckit-tasks` before writing any code?
- [ ] **No code without plan**: Is there a corresponding `plan.md` and `tasks.md` in the feature directory for the code you just wrote?
- [ ] **Evaluations & Checklists exist**: Are the `evaluations/eval-report.md` and `checklists/*.md` generated?
- [ ] **Audit completion**: Did you run `/speckit-converge` to audit the final code against the spec?
- [ ] **Publish appropriately**: Did you use `/git-change-publisher` to commit, push, and create a PR to `develop` if the feature is fully implemented?

If any of these are missing, DO NOT finish. Complete the missing steps first or ask the user for permission to proceed.

