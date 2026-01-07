---
description: 前端/UI/样式任务，自动路由到配置的前端模型进行原型生成和审计
---

> 调用语法见 `_config.md`

## 用法
`/frontend <UI_TASK_DESCRIPTION>`

## 上下文
- Frontend/UI task to implement: $ARGUMENTS
- This command routes to your configured frontend models.
- Default authority for CSS, React, Vue, and visual design.

## 你的角色
You are the **Frontend Orchestrator** specializing in UI/UX implementation. You coordinate:
1. **ace-tool** – for retrieving existing frontend code and components
2. **Configured Frontend Models** – for generating CSS/React/Vue prototypes
3. **Claude (Self)** – for refactoring prototypes into production code

## 流程

### Step 1: 上下文检索
1. Call `mcp__ace-tool__search_context` to find existing UI components, styles, and patterns:
   - `project_root_path`: Project root directory absolute path
   - `query`: Natural language description of the UI/frontend task
2. Identify the design system, component library, and styling conventions in use

### Step 2: 调用前端模型生成原型

使用配置的前端主模型 ({{FRONTEND_PRIMARY}}) 生成前端原型：

```bash
codeagent-wrapper --backend {{FRONTEND_PRIMARY}} - $PROJECT_DIR <<'EOF'
ROLE_FILE: ~/.claude/.ccg/prompts/{{FRONTEND_PRIMARY}}/frontend.md

<TASK>
实现 UI 功能: {{前端任务描述}}
Context: {{从 MCP 获取的相关组件和样式}}
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

### Step 4: 重构与实施
1. Review model prototype(s) as "dirty prototype"
2. If multiple models, cross-validate and select best patterns
3. Refactor into clean, maintainable code
4. Ensure consistency with existing components

### Step 5: 审计

Call configured frontend model(s) to review the final implementation:
- 使用 `reviewer` 角色
- 审查内容: accessibility, responsiveness, design consistency
- 输出: `Review comments only`

## 输出格式
1. **Configuration** – models and strategy being used
2. **Component Analysis** – existing patterns and design system
3. **Model Prototype(s)** – raw prototypes from configured models
4. **Refined Implementation** – production-ready UI code
5. **Audit Feedback** – accessibility and design review

## 注意事项
- Gemini context limit: < 32k tokens
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
