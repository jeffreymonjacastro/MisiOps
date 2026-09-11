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

## 🧠 Available Skills

The following skills are configured in this environment to provide specialized workflows:

### 1. Development Workflow (Speckit)

Speckit is the main engine for taking features from idea to code in a structured way:

- **`speckit-constitution`**: Defines and manages the project's architecture principles and rules.
- **`speckit-specify`**: Creates/updates the functional specification (`spec.md`).
- **`speckit-clarify`**: Resolves ambiguities in the specification by asking key questions.
- **`speckit-evaluate`**: Evaluates the specification against quality and format requirements.
- **`speckit-plan`**: Generates the technical implementation and architecture plan (`plan.md`).
- **`speckit-checklist`**: Generates quality/security verification checklists.
- **`speckit-tasks`**: Converts the plan into a dependency-ordered task list (`tasks.md`).
- **`speckit-analyze`**: Performs a cross-consistency analysis between spec, plan, and tasks.
- **`speckit-implement`**: Iteratively executes the code tasks.
- **`speckit-converge`**: Audits the final code against the specification and adds missing tasks if needed.
- **`speckit-taskstoissues`**: Exports local tasks as GitHub Issues.

### 2. Utilities and Productivity

- **`context7-mcp`**: Rules on when and how to use Context7 to look up up-to-date framework documentation.
- **`pretty-mermaid`**: Generation of flow and architecture diagrams in Mermaid format.
- **`git-change-publisher`**: Preparation, _Conventional Commits_ generation, and automatic branch/PR publishing.
- **`commit-message-writer`**: Clean commit message writing based on the staging area.
- **`caveman`**: Ultra-compressed communication modes to save context tokens in long sessions.
- **`frontend-design`**: Generates Tailwind CSS components and Next.js pages from user prompts.
- **`fastapi-templates`**: Generates FastAPI endpoints, models, and schemas from user prompts.

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

- **Language**: All specs, plans, tasks, checklists, commit messages, PR descriptions, and GitHub Issues **must be written in English**.
- **Token efficiency**: Always use **`/caveman`** mode to reduce output tokens.
- **Up-to-date docs**: Always use **`/context7-mcp`** before writing code that relies on third-party frameworks or libraries.
- **Skills & plugins**: Before implementing, review the `plan.md` and identify which skills, MCP servers, and plugins are needed. Load and use them proactively.
- **Branching**: Always create branches as **`feature/<feature-name>`** from `develop` using the GitHub MCP (`create_branch`). All Pull Requests **must target `develop`**.
- **Publishing**: Always run **`/git-change-publisher`** after a successful implementation to commit and push changes, and create the PR to `develop`.

---

## 🔌 MCP Servers (External Context)

Agents are recommended to use the following MCP servers (whose templates are in `mcp-config.json` and must be configured globally in the client):

### 1. Context7 (`context7`)

- **Purpose**: Provides real-time access to official documentation, SDKs, and up-to-date code examples from the web.
- **When to use it**: Whenever the agent needs to write code using third-party frameworks (e.g. React, Tailwind, FastAPI) to avoid hallucinations or the use of outdated APIs.
- **Main tools**: `resolve-library-id`, `query-docs`.

### 2. GitHub (`github-mcp-server`)

- **Purpose**: Direct integration with the GitHub API.
- **When to use it**: To manage repositories, read remote code, administer Pull Requests, search Issues, or create branches directly from chat.
- **Main tools**: `create_pull_request`, `search_repositories`, `list_issues`, `create_branch`, `get_file_contents`.

---

## Additional Plugins

### 1. Ponytail (`ponytail`)

- **Purpose**: Anti-magic, anti-overengineering approach (YAGNI). Use it (via `/ponytail-review`, `/ponytail-audit`, or by asking for "ponytail mode") to force the simplest possible solution, favoring the standard library over dependencies, and removing unnecessary abstractions.
- **When to use it**: Whenever the agent is about to add external dependencies, or when the proposed solution is detected to be too complex for the problem at hand.
- **Main tools**: `ponytail-review`, `ponytail-audit`, `ponytail-mode`.
