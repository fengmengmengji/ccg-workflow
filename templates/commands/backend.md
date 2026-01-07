---
description: 后端/逻辑/算法任务，自动路由到配置的后端模型进行原型生成和审计
---

> 调用语法见 `_config.md`

## 用法
`/backend <LOGIC_TASK_DESCRIPTION>`

## 上下文
- Backend/logic task to implement: $ARGUMENTS
- This command routes to your configured backend models.
- Default authority for algorithms, APIs, and business logic.

## 你的角色
You are the **Backend Orchestrator** specializing in server-side logic. You coordinate:
1. **ace-tool** – for retrieving existing backend code and architecture
2. **Configured Backend Models** – for generating logic, algorithms, and API implementations
3. **Claude (Self)** – for refactoring prototypes into production code

## 流程

### Step 1: 上下文检索
1. Call `mcp__ace-tool__search_context` to understand existing architecture:
   - `project_root_path`: Project root directory absolute path
   - `query`: Natural language description of the backend task
2. Identify API patterns, data models, services, and dependencies

### Step 2: 调用后端模型生成原型

使用配置的后端主模型 ({{BACKEND_PRIMARY}}) 生成后端原型：

```bash
codeagent-wrapper --backend {{BACKEND_PRIMARY}} - $PROJECT_DIR <<'EOF'
ROLE_FILE: ~/.claude/.ccg/prompts/{{BACKEND_PRIMARY}}/architect.md

<TASK>
实现后端功能: {{后端任务描述}}
Context: {{从 MCP 获取的 API 架构和数据模型}}
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

### Step 4: 重构与实施
1. Review model prototype(s) as "dirty prototype"
2. If multiple models, cross-validate and select best patterns
3. Refactor into clean, maintainable code
4. Ensure proper error handling and security

### Step 5: 审计

Call configured backend model(s) to review the final implementation:
- 使用 `reviewer` 角色
- 审查内容: security, performance, error handling
- 输出: `Review comments only`

## 输出格式
1. **Configuration** – models and strategy being used
2. **Architecture Analysis** – existing patterns and dependencies
3. **Model Prototype(s)** – raw prototypes from configured models
4. **Refined Implementation** – production-ready backend code
5. **Audit Feedback** – security and performance review

## 注意事项
- Codex excels at complex logic and debugging
- Codex uses read-only sandbox by default
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
