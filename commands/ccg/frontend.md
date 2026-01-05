---
description: 前端/UI/样式任务，自动路由到配置的前端模型进行原型生成和审计
---

## Usage
`/frontend <UI_TASK_DESCRIPTION>`

## Context
- Frontend/UI task to implement: $ARGUMENTS
- This command routes to your configured frontend models.
- Default authority for CSS, React, Vue, and visual design.

## Configuration
**首先读取 `~/.ccg/config.toml` 获取模型路由配置**:
```
[routing.frontend]
models = ["gemini", "codex"]  # 用户配置的前端模型列表
primary = "gemini"             # 主模型
strategy = "parallel"          # 路由策略: parallel | fallback | round-robin
```

## Your Role
You are the **Frontend Orchestrator** specializing in UI/UX implementation. You coordinate:
1. **ace-tool** – for retrieving existing frontend code and components
2. **Configured Frontend Models** – for generating CSS/React/Vue prototypes
3. **Claude (Self)** – for refactoring prototypes into production code

## Process

### Step 1: Read Configuration
1. Read `~/.ccg/config.toml` to get frontend model configuration
2. Identify which models to use based on `routing.frontend.models`
3. If config doesn't exist, default to `gemini`

### Step 2: Context Retrieval
1. **调用代码检索工具**:
   - 根据 `~/.ccg/config.toml` 中 `[mcp.tools] code_search_{provider}` 调用对应工具
   - 参数：`project_root_path`（项目根目录）, 查询内容为前端组件和样式
   - 查询参数名使用 `query_param_{provider}` 的值（"query" 或 "information_request"）
2. Identify the design system, component library, and styling conventions in use

### Step 3: Model Prototype

**根据配置的 strategy 执行**:

- **parallel**: 同时调用所有配置的前端模型，综合结果
- **fallback**: 调用主模型，失败则调用次模型
- **round-robin**: 轮询调用

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

```bash
# 示例：调用配置的前端模型 (根据 config.toml 选择)
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/frontend.md 的内容并注入
如果是 gemini: prompts/gemini/frontend.md
如果是 codex: prompts/codex/architect.md (Codex 无专门前端角色)
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

**如果 strategy = parallel 且有多个模型**:
使用 `run_in_background: true` 并行调用所有模型，然后用 `TaskOutput` 收集结果。

### Step 4: Refactor & Implement
1. Review model prototype(s) as "dirty prototype"
2. If multiple models, cross-validate and select best patterns
3. Refactor into clean, maintainable code
4. Ensure consistency with existing components

### Step 5: Audit

Call configured frontend model(s) to review the final implementation:

```bash
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review this UI implementation for: accessibility, responsiveness, design consistency.
<provide diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

## Output Format
1. **Configuration** – models and strategy being used
2. **Component Analysis** – existing patterns and design system
3. **Model Prototype(s)** – raw prototypes from configured models
4. **Refined Implementation** – production-ready UI code
5. **Audit Feedback** – accessibility and design review

## Notes
- Gemini context limit: < 32k tokens
- Read `~/.ccg/config.toml` at start of execution
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
