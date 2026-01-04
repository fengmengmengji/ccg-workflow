---
description: 多模型代码生成（智能路由：前端→Gemini，后端→Codex）
---

# /ccg:code - 多模型代码生成

## Usage
`/ccg:code <功能描述>`

## Context
- 功能描述: $ARGUMENTS
- 智能检测任务类型，自动路由到合适的模型
- 生成的原型经 Claude 重构为生产级代码

## 工作流程

### Phase 1: 需求分析

1. 调用 `mcp__auggie-mcp__codebase-retrieval` 检索：
   - 相关模块和文件结构
   - 现有代码模式和风格
   - 依赖和接口定义
2. 分析任务类型：
   - **前端**: UI 组件、样式、用户交互
   - **后端**: API、业务逻辑、数据库操作
   - **全栈**: 同时涉及前后端

### Phase 2: 智能路由

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

#### Route A: 前端任务 → Gemini
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/frontend.md 的内容并注入
</ROLE>

<TASK>
Implement: <功能描述>

Context:
<相关代码>
<设计系统/组件库信息>
</TASK>

OUTPUT: Unified Diff Patch ONLY.
EOF
```

#### Route B: 后端任务 → Codex
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/architect.md 的内容并注入
</ROLE>

<TASK>
Implement: <功能描述>

Context:
<相关代码>
<API 规范/数据模型>
</TASK>

OUTPUT: Unified Diff Patch ONLY.
EOF
```

#### Route C: 全栈任务 → 并行生成

**同时启动（`run_in_background: true`）**：

1. **Codex**: 使用 `prompts/codex/architect.md` 角色，生成后端 API + 数据层
2. **Gemini**: 使用 `prompts/gemini/frontend.md` 角色，生成前端组件 + UI 交互

定义清晰的接口契约：
```
API Contract:
- Endpoint: POST /api/xxx
- Request: { field1: string, field2: number }
- Response: { data: T, error?: string }
```

### Phase 3: 原型整合

1. 收集模型输出（使用 `TaskOutput`）
2. 将 Unified Diff 视为"脏原型"
3. Claude 重构：
   - 统一代码风格
   - 确保前后端接口一致
   - 优化实现细节
   - 移除冗余代码

### Phase 4: 代码实施

1. 应用重构后的代码
2. 确保不破坏现有功能
3. 验证编译/类型检查通过

### Phase 5: 双模型审查

**并行启动审查（`run_in_background: true`）**：

**注意**：调用前先读取对应角色提示词文件（reviewer），将内容注入到 `<ROLE>` 标签中。

```bash
# Codex 审查
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review the implementation for: <功能描述>

Changes:
<实施的代码变更>
</TASK>

OUTPUT: Review comments with specific line references.
EOF
```

```bash
# Gemini 审查
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/reviewer.md 的内容并注入
</ROLE>

<TASK>
Review the implementation for: <功能描述>

Changes:
<实施的代码变更>
</TASK>

OUTPUT: Review comments with specific line references.
EOF
```

### Phase 6: 修正与交付

1. 综合双模型审查意见
2. 修正发现的问题
3. 最终交付

## 输出格式

```
## 🚀 Code: <功能描述>

### Phase 1: 需求分析
- 任务类型: [前端/后端/全栈]
- 相关文件: <文件列表>
- 现有模式: <识别的模式>

### Phase 2: 代码生成
#### [Codex/Gemini] 原型
<Unified Diff 摘要>

### Phase 3: 整合重构
<重构说明>

### Phase 4: 实施
<变更文件列表>

### Phase 5: 审查
#### Codex 审查
- <审查意见 1>
- <审查意见 2>

#### Gemini 审查
- <审查意见 1>
- <审查意见 2>

### Phase 6: 交付
✅ 实施完成
- 新增文件: X
- 修改文件: Y
- 代码行数: +N / -M
```

## 任务类型检测

| 关键词 | 类型 | 路由 |
|--------|------|------|
| component, UI, style, CSS, React, Vue | 前端 | Gemini |
| API, endpoint, database, auth, backend | 后端 | Codex |
| full-stack, 全栈, 页面+接口 | 全栈 | 并行 |

## 代码质量标准

### 前端代码 (Gemini)
- [ ] TypeScript 类型完整
- [ ] 响应式设计
- [ ] 无障碍属性
- [ ] 加载/错误状态
- [ ] 遵循设计系统

### 后端代码 (Codex)
- [ ] 输入验证
- [ ] 错误处理
- [ ] 安全检查
- [ ] 查询优化
- [ ] API 一致性

## 关键原则

1. **智能路由** - 根据任务自动选择最合适的模型
2. **接口优先** - 全栈任务先定义 API 契约
3. **原型重构** - 外部模型输出需要 Claude 重构
4. **双重审查** - 代码必须经过双模型审查
