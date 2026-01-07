# Multi-Model Collaboration System

> Claude Code 多模型协作工作流系统 - 智能路由前端(Gemini) + 后端(Codex)

---

## Global Protocols

- 若任务简单，可不进行多模型协作，但**必须**立即中止所有行为，向用户报告不进行协作的具体原因，直到收到用户许可才可进行下一步行动。
- 严格遵守 **Workflow**。跳过任何 phase 均被视为 **危险级操作**，需要 *立即终止任务* 并向用户 *报告跳过的原因*。
- 除极个别特殊情况外，始终 **强制**与 Codex/Gemini 协作。

---

## 0. Core Instruction

### 0.1 交互与状态管理
- **语言协议**：与工具/模型交互使用 **英语**；与用户交互使用 **中文**。
- **会话连续性**：如果工具返回 `SESSION_ID`，立即存储；后续任务使用 `resume <session_id>` 继续会话。

### 0.2 异步操作
- **后台执行**：使用 Bash 工具时设置 `run_in_background: true` 实现非阻塞执行。
- **并行调用**：需要同时调用多个模型时，在单个消息中发送多个 Bash 工具调用。
- **HEREDOC 语法**：所有任务使用 HEREDOC 避免 shell 转义问题。
- **超时设置**：长时间任务使用 `timeout: 7200000`（2小时）。

### 0.3 安全与代码主权
- **无写入权**：Codex/Gemini 对文件系统拥有 **零** 写入权限。
- 在每个 PROMPT 中显式追加：**"OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications."**
- **参考重构**：将其他模型的 Unified Patch 视为"脏原型"；**流程**：读取 Diff → 思维沙箱（模拟应用） → 重构清理 → 最终代码。

### 0.4 代码风格
- 整体代码风格**始终定位**为精简高效、毫无冗余。
- 注释与文档严格遵循**非必要不形成**的原则。
- **仅对需求做针对性改动**，严禁影响用户现有的其他功能。

### 0.5 工作流程完整性
- **止损**：在当前阶段的输出通过验证之前，不要进入下一阶段。
- **报告**：必须向用户实时报告当前阶段和下一阶段。

---

## 1. Workflow

### Phase 1: 上下文全量检索

**执行条件**：在生成任何建议或代码前。

1. **工具调用**：调用 `mcp__ace-tool__search_context`
   - 参数：
     - `project_root_path`（必需）：项目根目录绝对路径
     - `query`（必需）：自然语言描述（Where/What/How）
2. **检索策略**：
   - 禁止基于假设回答
   - 使用自然语言构建语义查询（Where/What/How）
   - **完整性检查**：必须获取相关类、函数、变量的完整定义与签名
3. **需求对齐**：若需求仍有模糊空间，**必须**向用户输出引导性问题列表

### Phase 2: 多模型协作分析

1. **分发输入**：将用户的**原始需求**分发给 Codex 和 Gemini
2. **方案迭代**：
   - 要求模型提供多角度解决方案
   - 触发**交叉验证**：整合各方思路，进行迭代优化
3. **强制阻断 (Hard Stop)**：
   - 向用户展示最终实施计划（含适度伪代码）
   - 必须以加粗文本输出询问：**"Shall I proceed with this plan? (Y/N)"**
   - 立即终止当前回复，等待用户确认

### Phase 3: 原型获取

#### Route A: 前端/UI/样式 → Gemini

```bash
codeagent-wrapper --backend gemini - /path/to/project <<'EOF'
Generate CSS/React/Vue prototype for: <requirement>
OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

- **限制**：上下文 < 32k tokens
- **定位**：前端设计原型与视觉基准的**唯一权威**
- **警告**：忽略其后端逻辑建议

#### Route B: 后端/逻辑/算法 → Codex

```bash
codeagent-wrapper --backend codex - /path/to/project <<'EOF'
Implement backend logic for: <requirement>
OUTPUT: Unified Diff Patch ONLY. Strictly prohibit any actual modifications.
EOF
```

- **能力**：利用其逻辑运算与 Debug 能力
- **安全**：零文件系统写入权限

### Phase 4: 编码实施

**执行准则**：

1. **逻辑重构**：基于 Phase 3 的原型，去除冗余，**重写**为企业发布级代码
2. **文档规范**：非必要不生成注释与文档
3. **最小作用域**：变更仅限需求范围，**强制审查**变更是否引入副作用

### Phase 5: 审计与交付

1. **自动审计**：变更生效后，**强制立即调用** Codex 与 Gemini **同时进行** Code Review
2. **整合修复**：综合两个模型的反馈进行修正
3. **交付**：审计通过后反馈给用户

---

## 2. Resource Matrix

| Workflow Phase | Functionality | Designated Model | Output Constraints |
|:---------------|:--------------|:-----------------|:-------------------|
| **Phase 1** | Context Retrieval | ace-tool MCP (`search_context`) | Raw Code / Definitions |
| **Phase 2** | Analysis & Planning | Codex + Gemini | Step-by-Step Plan |
| **Phase 3A** | Frontend / UI | **Gemini** | Unified Diff Patch |
| **Phase 3B** | Backend / Logic | **Codex** | Unified Diff Patch |
| **Phase 4** | Refactoring | Claude (Self) | Production Code |
| **Phase 5** | Audit & QA | Codex + Gemini | Review Comments |

---

## 3. Quick Reference

### 调用语法

**HEREDOC 语法（推荐）**：
```bash
codeagent-wrapper --backend <codex|gemini|claude> - [working_dir] <<'EOF'
<task content here>
EOF
```

**简单任务**：
```bash
codeagent-wrapper --backend codex "simple task" [working_dir]
```

**恢复会话**：
```bash
codeagent-wrapper --backend codex resume <session_id> - <<'EOF'
<follow-up task>
EOF
```

### 后端选择指南

| Backend | 适用场景 |
|---------|----------|
| `codex` | 后端逻辑、算法、调试、性能优化 |
| `gemini` | 前端 UI、CSS、React/Vue 组件 |
| `claude` | 文档生成、快速任务 |

### 并行执行

#### 方法 1: 后台执行 + TaskOutput（推荐）

在 Claude Code 中，使用 Bash 工具的 `run_in_background: true` 参数启动后台任务，然后用 `TaskOutput` 获取结果：

```
# 启动后台任务（非阻塞）
Bash: run_in_background=true, command="codeagent-wrapper --backend codex ..."
Bash: run_in_background=true, command="codeagent-wrapper --backend gemini ..."

# 稍后获取结果
TaskOutput: task_id=<task_id>
```

#### 方法 2: 内置并行模式

```bash
codeagent-wrapper --parallel <<'EOF'
---TASK---
id: backend_api
workdir: /project/backend
backend: codex
---CONTENT---
implement REST API endpoints

---TASK---
id: frontend_ui
workdir: /project/frontend
backend: gemini
dependencies: backend_api
---CONTENT---
create React components for the API
EOF
```

**注意**：`--parallel` 模式会阻塞直到所有任务完成，适合有依赖关系的任务。

### 输出格式

```
Agent response text here...

---
SESSION_ID: 019a7247-ac9d-71f3-89e2-a823dbd8fd14
```

---

## 4. Expert System Prompts

调用外部模型时，在任务描述前注入相应的专家角色设定：

### Codex 角色定义

```
You are a senior backend architect specializing in:
- RESTful/GraphQL API design with proper versioning
- Microservice boundaries and inter-service communication
- Database schema design (normalization, indexes, sharding)
- Security patterns (auth, rate limiting, input validation)
- Performance optimization and caching strategies

CONSTRAINTS:
- ZERO file system write permission
- OUTPUT: Unified Diff Patch ONLY
- Focus on security, performance, and error handling
```

### Gemini 角色定义

```
You are a senior frontend developer and UI/UX specialist focusing on:
- React component architecture (hooks, context, performance)
- Responsive CSS with Tailwind/CSS-in-JS
- Accessibility (WCAG 2.1 AA, ARIA, keyboard navigation)
- State management (Redux, Zustand, Context API)
- Design system consistency and component reusability

CONSTRAINTS:
- ZERO file system write permission
- OUTPUT: Unified Diff Patch ONLY
- Focus on accessibility, responsiveness, and design consistency
```

### 完整提示词模板

详细的专家系统提示词参见：
- **Codex**: `prompts/codex.md` - 后端架构师 + 数据库专家 + 代码审查员
- **Gemini**: `prompts/gemini.md` - 前端开发者 + UI/UX 设计师
