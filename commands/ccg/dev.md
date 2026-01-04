---
description: 完整6阶段多模型协作工作流（Prompt增强 → 上下文检索 → 多模型分析 → 原型生成 → 代码实施 → 审计交付）
---

## 用法
`/dev <功能描述>`

## 上下文
- 要实现的功能: $ARGUMENTS
- 此命令触发完整的 6 阶段多模型协作工作流
- 前端任务路由到 Gemini，后端任务路由到 Codex

## 你的角色
你是**编排者**，协调多模型协作系统。你指挥:
1. **Auggie** – 用于 Prompt 增强和代码库上下文检索
2. **Codex** – 用于后端逻辑、算法和调试
3. **Gemini** – 用于前端 UI/UX 和视觉设计
4. **Claude (自己)** – 用于最终代码重构和交付

## 流程

### 阶段 0: Prompt 增强
1. 调用 `mcp__auggie-mcp__prompt-enhancer` 优化原始需求
2. 向用户展示原始和增强后的 prompt:

```
📝 原始需求:
<原始需求>

✨ 增强后需求:
<增强后需求>

---
**使用增强后的需求继续？(Y/N)**
```

3. **强制停止**: 等待用户确认
   - 如果 Y: 后续阶段使用增强后的 prompt
   - 如果 N: 使用原始 prompt 或要求修改

### 阶段 1: 上下文检索
1. 调用 `mcp__auggie-mcp__codebase-retrieval` 获取（增强后的）需求相关代码
2. 识别所有相关文件、类、函数和依赖
3. 如需求仍不清晰，提出澄清问题

### 阶段 2: 多模型分析

**并行调用 Codex 和 Gemini 进行分析**（使用 `run_in_background: true` 非阻塞执行）：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

在单个消息中同时发送两个 Bash 工具调用：

```bash
# Codex 分析
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/analyzer.md 的内容并注入
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
# Gemini 分析
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/analyzer.md 的内容并注入
</ROLE>

<TASK>
分析此需求: <需求>

Context:
<相关代码和设计信息>
</TASK>

OUTPUT: 提供前端/UI方面的实现方案。
EOF
```

然后使用 `TaskOutput` 获取两个任务的结果，交叉验证后综合方案。

**强制停止**: 询问用户 **"是否继续执行此方案？(Y/N)"** 并等待确认

### 阶段 3: 原型生成

根据任务类型选择路由：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

**路由 A (前端/UI)** → 使用 Gemini:
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/frontend.md 的内容并注入
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

**路由 B (后端/逻辑)** → 使用 Codex:
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/architect.md 的内容并注入
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

**如果同时有前端和后端任务**，使用 `run_in_background: true` 并行执行两者。

### 阶段 4: 代码实施
1. 将原型视为"脏原型" – 仅作参考
2. 重构为干净的生产级代码
3. 验证变更不会引入副作用

### 阶段 5: 审计与交付

**并行调用 Codex 和 Gemini 进行代码审查**（使用 `run_in_background: true`）：

**注意**：调用前先读取对应角色提示词文件（reviewer），将内容注入到 `<ROLE>` 标签中。

```bash
# Codex 审查
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/reviewer.md 的内容并注入
</ROLE>

<TASK>
审查此实现: 安全性、性能、错误处理。
<提供 diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

```bash
# Gemini 审查
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/reviewer.md 的内容并注入
</ROLE>

<TASK>
审查此实现: 可访问性、响应式设计、设计一致性。
<提供 diff>
</TASK>

OUTPUT: Review comments only.
EOF
```

使用 `TaskOutput` 获取两个审查结果，整合反馈后修正并交付。

## 输出格式
1. **增强后需求** – 优化后的 prompt (阶段 0)
2. **上下文摘要** – 识别的相关代码元素
3. **实施方案** – 含模型路由的逐步方案
4. **代码变更** – 生产级实现
5. **审计报告** – 审查反馈和修正
6. **后续步骤** – 部署或跟进操作

## 关键规则
- 未经用户批准不得跳过任何阶段
- **阶段 0 的 prompt 增强是强制性的** – 必须先展示增强后的 prompt
- 始终要求外部模型输出 Unified Diff Patch
- 外部模型对文件系统**零写入权限**
- 实时向用户报告当前阶段和下一阶段
- 使用 HEREDOC 语法 (`<<'EOF'`) 避免 shell 转义问题
- **并行模型调用使用 `run_in_background: true`** 避免阻塞
