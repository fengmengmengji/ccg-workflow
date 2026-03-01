---
description: '需求 → 约束集（并行探索 + OPSX 提案）'
---
<!-- CCG:SPEC:RESEARCH:START -->
**Core Philosophy**
- Research produces **constraint sets**, not information dumps. Each constraint narrows the solution space.
- Constraints tell subsequent stages "don't consider this direction," enabling mechanical execution without decisions.
- Output: 约束集合 + 可验证的成功判据 (constraint sets + verifiable success criteria).
- Strictly adhere to OPSX rules when writing spec-structured documents.

**Guardrails**
- **STOP! BEFORE ANY OTHER ACTION**: You MUST perform Prompt Enhancement FIRST. This is NON-NEGOTIABLE.
- **NEVER** divide subagent tasks by roles (e.g., "架构师agent", "安全专家agent").
- **ALWAYS** divide by context boundaries (e.g., "user-related code", "authentication logic").
- Each subagent context must be self-contained with independent output.
- Use `{{MCP_SEARCH_TOOL}}` to minimize grep/find operations.
- Do not make architectural decisions—surface constraints that guide decisions.

**Steps**
0. **MANDATORY: Enhance Requirement FIRST**
   - **DO THIS IMMEDIATELY. DO NOT SKIP.**
   - **Prompt 增强**（按 `/ccg:enhance` 的逻辑执行）：分析 $ARGUMENTS 的意图、缺失信息、隐含假设，补全为结构化需求（明确目标、技术约束、范围边界、验收标准）。
   - Use enhanced prompt for ALL subsequent steps.

1. **Generate OPSX Change**
   - Check if change already exists:
     ```bash
     openspec list --json
     ```
   - If change doesn't exist, create it:
     ```bash
     openspec new change "<brief-descriptive-name>"
     ```
   - This scaffolds `openspec/changes/<name>/` with proposal.md.
   - If change already exists, continue with existing change.

2. **Initial Codebase Assessment**
   - Use `{{MCP_SEARCH_TOOL}}` to scan codebase.
   - Determine project scale: single vs multi-directory structure.
   - **Decision**: If multi-directory → enable parallel Explore subagents.

3. **Define Exploration Boundaries (Context-Based)**
   - Identify natural context boundaries (NOT functional roles):
     * Subagent 1: User domain code (models, services, UI)
     * Subagent 2: Auth & authorization (middleware, session, tokens)
     * Subagent 3: Infrastructure (configs, deployments, builds)
   - Each boundary should be self-contained: no cross-communication needed.

4. **Parallel Multi-Model Exploration**
   - Dispatch Explore subagents with unified output template:
   ```json
   {
     "module_name": "context boundary explored",
     "existing_structures": ["key patterns found"],
     "existing_conventions": ["standards in use"],
     "constraints_discovered": ["hard constraints limiting solution space"],
     "open_questions": ["ambiguities requiring user input"],
     "dependencies": ["cross-module dependencies"],
     "risks": ["potential blockers"],
     "success_criteria_hints": ["observable success behaviors"]
   }
   ```
   - Run Codex for backend boundaries, Gemini for frontend boundaries.

5. **Aggregate and Synthesize**
   - Collect all subagent outputs.
   - Merge into unified constraint sets:
     * **Hard constraints**: Technical limitations, patterns that cannot be violated
     * **Soft constraints**: Conventions, preferences, style guides
     * **Dependencies**: Cross-module relationships affecting implementation order
     * **Risks**: Blockers needing mitigation

6. **User Interaction for Ambiguity Resolution**
   - Compile prioritized list of open questions.
   - Use `AskUserQuestion` tool to present systematically:
     * Group related questions
     * Provide context for each
     * Suggest defaults when applicable
   - Capture responses as additional constraints.

7. **Finalize OPSX Proposal**
   - Transform constraint sets into OPSX format:
     * **Context**: User need + discovered constraints
     * **Requirements**: Each constraint becomes requirement with scenario
     * **Success Criteria**: Derived from hints and user confirmations
   - Ensure proposal includes:
     * All discovered constraints as requirements
     * Verifiable scenarios for each requirement
     * Clear dependencies and sequencing
     * Risk mitigation strategies

8. **Context Checkpoint**
   - Report current context usage.
   - If approaching 80K tokens, suggest: "Run `/clear` and continue with `/ccg:spec-plan`"

**Reference**
- OPSX CLI: `openspec status --change "<id>" --json`, `openspec list --json`
- Check prior research: `ls openspec/changes/*/`
- Use `AskUserQuestion` for ANY ambiguity—never assume or guess
<!-- CCG:SPEC:RESEARCH:END -->
