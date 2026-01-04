---
description: 前端/UI/样式任务，自动路由到 Gemini 进行原型生成和审计
---

## Usage
`/frontend <UI_TASK_DESCRIPTION>`

## Context
- Frontend/UI task to implement: $ARGUMENTS
- This command routes directly to Gemini for frontend prototyping.
- Gemini is the **authority** for CSS, React, Vue, and visual design.

## Your Role
You are the **Frontend Orchestrator** specializing in UI/UX implementation. You coordinate:
1. **Auggie** – for retrieving existing frontend code and components
2. **Gemini** – for generating CSS/React/Vue prototypes
3. **Claude (Self)** – for refactoring prototypes into production code

## Process

### Step 1: Context Retrieval
1. Call `mcp__auggie-mcp__codebase-retrieval` to find existing UI components, styles, and patterns
2. Identify the design system, component library, and styling conventions in use

### Step 2: Gemini Prototype

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/frontend.md 的内容并注入
</ROLE>

<TASK>
Generate frontend prototype for: <task>

Context:
<相关代码>
<设计系统/组件库信息>
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

### Step 3: Refactor & Implement
1. Review Gemini's prototype as a "dirty prototype"
2. Validate against existing design system
3. Refactor into clean, maintainable code
4. Ensure consistency with existing components

### Step 4: Audit

Call Gemini again to review the final implementation:

```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review this UI implementation for: accessibility, responsiveness, design consistency.
<provide diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

## Output Format
1. **Component Analysis** – existing patterns and design system
2. **Gemini Prototype** – raw prototype from Gemini
3. **Refined Implementation** – production-ready UI code
4. **Audit Feedback** – accessibility and design review

## Notes
- Gemini context limit: < 32k tokens
- Ignore any backend logic suggestions from Gemini
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
