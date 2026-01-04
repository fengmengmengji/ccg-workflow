---
description: 后端/逻辑/算法任务，自动路由到 Codex 进行原型生成和审计
---

## Usage
`/backend <LOGIC_TASK_DESCRIPTION>`

## Context
- Backend/logic task to implement: $ARGUMENTS
- This command routes directly to Codex for backend implementation.
- Codex is the **authority** for algorithms, APIs, and business logic.

## Your Role
You are the **Backend Orchestrator** specializing in server-side logic. You coordinate:
1. **Auggie** – for retrieving existing backend code and architecture
2. **Codex** – for generating logic, algorithms, and API implementations
3. **Claude (Self)** – for refactoring prototypes into production code

## Process

### Step 1: Context Retrieval
1. Call `mcp__auggie-mcp__codebase-retrieval` to understand existing architecture
2. Identify API patterns, data models, services, and dependencies

### Step 2: Codex Prototype

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/architect.md 的内容并注入
</ROLE>

<TASK>
Implement backend logic for: <task>

Context:
<相关代码>
<API 规范/数据模型>
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

### Step 3: Refactor & Implement
1. Review Codex's prototype as a "dirty prototype"
2. Validate against existing architecture
3. Refactor into clean, maintainable code
4. Ensure proper error handling and security

### Step 4: Audit

Call Codex again to review the final implementation:

```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review this backend implementation for: security, performance, error handling.
<provide diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

## Output Format
1. **Architecture Analysis** – existing patterns and dependencies
2. **Codex Prototype** – raw prototype from Codex
3. **Refined Implementation** – production-ready backend code
4. **Audit Feedback** – security and performance review

## Notes
- Codex excels at complex logic and debugging
- Codex uses read-only sandbox by default
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
