---
description: 完整6阶段多模型协作工作流（Prompt增强 → 上下文检索 → 多模型分析 → 原型生成 → 代码实施 → 审计交付）
---

## 用法
`/dev <功能描述>`

## 上下文
- 要实现的功能: $ARGUMENTS
- 此命令触发完整的 6 阶段多模型协作工作流
- 根据 `~/.ccg/config.toml` 配置路由模型

## 配置
**首先读取 `~/.ccg/config.toml` 获取模型路由配置**:
```toml
[routing]
mode = "smart"  # smart | parallel | sequential

[routing.frontend]
models = ["gemini", "codex"]
primary = "gemini"
strategy = "parallel"

[routing.backend]
models = ["codex", "gemini"]
primary = "codex"
strategy = "parallel"

[routing.review]
models = ["codex", "gemini"]
strategy = "parallel"
```

## 你的角色
你是**编排者**，协调多模型协作系统。你指挥:
1. **ace-tool** – 用于 Prompt 增强和代码库上下文检索
2. **配置的后端模型** – 用于后端逻辑、算法和调试
3. **配置的前端模型** – 用于前端 UI/UX 和视觉设计
4. **Claude (自己)** – 用于最终代码重构和交付

## 流程

### 阶段 0: 读取配置 + Prompt 增强
1. **读取 `~/.ccg/config.toml`** 获取 MCP 提供商和模型路由配置
   - 如果配置不存在，使用默认值：provider=ace-tool, frontend=gemini, backend=codex
   - 根据 `[mcp] provider` 字段确定使用的 MCP 工具

2. **Prompt 增强**:
   - 读取 `~/.ccg/config.toml` 获取 `[mcp.tools] prompt_enhance_{provider}` 的工具名称
   - 如果工具名为空字符串（如 auggie 的 `prompt_enhance_auggie = ""`），跳过增强，提示用户查看配置中的 setup_url
   - 否则调用该工具，参数：`project_root_path`, `prompt`, `conversation_history`

3. 根据用户选择继续后续阶段

### 阶段 1: 上下文检索
1. **调用代码检索工具**:
   - 读取 `~/.ccg/config.toml` 获取 `[mcp] provider` 值（如 "ace-tool" 或 "auggie"）
   - 使用 `[mcp.tools] code_search_{provider}` 配置的工具名称
   - 参数：`project_root_path`（项目根目录），查询参数名使用 `query_param_{provider}` 的值（"query" 或 "information_request"）

2. 识别所有相关文件、类、函数和依赖
3. 如需求仍不清晰，提出澄清问题

### 阶段 2: 多模型分析

**根据配置并行调用模型进行分析**（使用 `run_in_background: true` 非阻塞执行）：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

根据 `routing.backend.models` 和 `routing.frontend.models` 动态生成调用：

```bash
# 后端模型分析 (遍历 routing.backend.models)
codeagent-wrapper --backend <BACKEND_MODEL> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/analyzer.md 的内容并注入
</ROLE>

<TASK>
分析此需求: <需求>

Context:
<相关代码和架构信息>
</TASK>

OUTPUT: 提供后端/逻辑方面的实现方案。
EOF
```

```bash
# 前端模型分析 (遍历 routing.frontend.models)
codeagent-wrapper --backend <FRONTEND_MODEL> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/analyzer.md 的内容并注入
</ROLE>

<TASK>
分析此需求: <需求>

Context:
<相关代码和设计信息>
</TASK>

OUTPUT: 提供前端/UI方面的实现方案。
EOF
```

然后使用 `TaskOutput` 获取所有任务的结果，交叉验证后综合方案。

**强制停止**: 询问用户 **"是否继续执行此方案？(Y/N)"** 并等待确认

### 阶段 3: 原型生成

根据任务类型和配置选择路由：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

**路由 A (前端/UI)** → 使用配置的前端模型:
```bash
# 遍历 routing.frontend.models，根据 strategy 执行
codeagent-wrapper --backend <FRONTEND_MODEL> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/frontend.md 的内容并注入
如果是 codex: 使用 prompts/codex/architect.md
</ROLE>

<TASK>
生成前端原型: <任务>

Context:
<相关代码>
<设计系统/组件库信息>
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

**路由 B (后端/逻辑)** → 使用配置的后端模型:
```bash
# 遍历 routing.backend.models，根据 strategy 执行
codeagent-wrapper --backend <BACKEND_MODEL> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/architect.md 的内容并注入
如果是 gemini: 使用 prompts/gemini/analyzer.md
</ROLE>

<TASK>
实现后端逻辑: <任务>

Context:
<相关代码>
<API 规范/数据模型>
</TASK>

OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

**如果同时有前端和后端任务**，使用 `run_in_background: true` 并行执行。
**如果 strategy = parallel 且有多个模型**，同时调用所有模型并交叉验证结果。

### 阶段 4: 代码实施
1. 将原型视为"脏原型" – 仅作参考
2. 如果有多个模型结果，交叉验证选择最佳方案
3. 重构为干净的生产级代码
4. 验证变更不会引入副作用

### 阶段 5: 审计与交付

**并行调用 `routing.review.models` 中的所有模型进行代码审查**：

**注意**：调用前先读取对应角色提示词文件（reviewer），将内容注入到 `<ROLE>` 标签中。

```bash
# 遍历 routing.review.models 进行审查
codeagent-wrapper --backend <REVIEW_MODEL> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/reviewer.md 的内容并注入
</ROLE>

<TASK>
审查此实现:
- 如果是后端: 安全性、性能、错误处理
- 如果是前端: 可访问性、响应式设计、设计一致性
<提供 diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

使用 `TaskOutput` 获取所有审查结果，整合反馈后修正并交付。

## 输出格式
1. **配置信息** – 使用的模型和路由策略
2. **增强后需求** – 优化后的 prompt (阶段 0)
3. **上下文摘要** – 识别的相关代码元素
4. **实施方案** – 含模型路由的逐步方案
5. **代码变更** – 生产级实现
6. **审计报告** – 审查反馈和修正
7. **后续步骤** – 部署或跟进操作

## 关键规则
- 未经用户批准不得跳过任何阶段
- **首先读取 `~/.ccg/config.toml` 获取模型配置**
- **阶段 0 的 prompt 增强是强制性的** – 必须先展示增强后的 prompt
- 始终要求外部模型输出 Unified Diff Patch
- 外部模型对文件系统**零写入权限**
- 实时向用户报告当前阶段和下一阶段
- 使用 HEREDOC 语法 (`<<'EOF'`) 避免 shell 转义问题
- **并行模型调用使用 `run_in_background: true`** 避免阻塞
- **多模型结果需交叉验证，取长补短**
