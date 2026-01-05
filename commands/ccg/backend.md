---
description: 后端/逻辑/算法任务，自动路由到配置的后端模型进行原型生成和审计
---

## Usage
`/backend <LOGIC_TASK_DESCRIPTION>`

## Context
- Backend/logic task to implement: $ARGUMENTS
- This command routes to your configured backend models.
- Default authority for algorithms, APIs, and business logic.

## Configuration
**首先读取 `~/.ccg/config.toml` 获取模型路由配置**:
```
[routing.backend]
models = ["codex", "gemini"]  # 用户配置的后端模型列表
primary = "codex"              # 主模型
strategy = "parallel"          # 路由策略: parallel | fallback | round-robin
```

## Your Role
You are the **Backend Orchestrator** specializing in server-side logic. You coordinate:
1. **ace-tool** – for retrieving existing backend code and architecture
2. **Configured Backend Models** – for generating logic, algorithms, and API implementations
3. **Claude (Self)** – for refactoring prototypes into production code

## Process

### Step 1: Read Configuration
1. Read `~/.ccg/config.toml` to get backend model configuration
2. Identify which models to use based on `routing.backend.models`
3. If config doesn't exist, default to `codex`

### Step 2: Context Retrieval
1. **调用代码检索工具**:
   - 根据 `~/.ccg/config.toml` 中 `[mcp.tools] code_search_{provider}` 调用对应工具
   - 参数：`project_root_path`（项目根目录）, 查询内容为后端架构和相关代码
   - 查询参数名使用 `query_param_{provider}` 的值（"query" 或 "information_request"）
2. Identify API patterns, data models, services, and dependencies

### Step 3: Model Prototype

**根据配置的 strategy 执行**:

- **parallel**: 同时调用所有配置的后端模型，综合结果
- **fallback**: 调用主模型，失败则调用次模型
- **round-robin**: 轮询调用

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

```bash
# 示例：调用配置的后端模型 (根据 config.toml 选择)
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/architect.md 的内容并注入
如果是 codex: prompts/codex/architect.md
如果是 gemini: prompts/gemini/analyzer.md (Gemini 无专门后端角色)
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

**如果 strategy = parallel 且有多个模型**:
使用 `run_in_background: true` 并行调用所有模型，然后用 `TaskOutput` 收集结果。

### Step 4: Refactor & Implement
1. Review model prototype(s) as "dirty prototype"
2. If multiple models, cross-validate and select best patterns
3. Refactor into clean, maintainable code
4. Ensure proper error handling and security

### Step 5: Audit

Call configured backend model(s) to review the final implementation:

```bash
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review this backend implementation for: security, performance, error handling.
<provide diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

## Output Format
1. **Configuration** – models and strategy being used
2. **Architecture Analysis** – existing patterns and dependencies
3. **Model Prototype(s)** – raw prototypes from configured models
4. **Refined Implementation** – production-ready backend code
5. **Audit Feedback** – security and performance review

## Notes
- Codex excels at complex logic and debugging
- Codex uses read-only sandbox by default
- Read `~/.ccg/config.toml` at start of execution
- Always request Unified Diff Patch format
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
