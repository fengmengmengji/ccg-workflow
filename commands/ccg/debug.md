---
description: UltraThink 多模型调试（Codex 后端诊断 + Gemini 前端诊断）
---

# /ccg:debug - UltraThink 多模型调试

## Usage
`/ccg:debug <问题描述>`

## Context
- 问题描述: $ARGUMENTS
- 使用 Auggie 检索相关代码上下文
- Codex 专注后端/逻辑问题，Gemini 专注前端/UI问题

## 工作流程

### Phase 1: 上下文检索

1. 调用 `mcp__auggie-mcp__codebase-retrieval` 检索相关代码
2. 收集错误日志、堆栈信息、复现步骤
3. 识别问题涉及的模块（前端/后端/全栈）

### Phase 2: 并行诊断

**同时启动两个后台任务（`run_in_background: true`）**：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

#### Codex 后端诊断
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
{{读取 prompts/codex/debugger.md 的内容}}
</ROLE>

<TASK>
Debug: <问题描述>

Context:
<相关代码>
</TASK>

OUTPUT: Structured diagnostic report. No code modifications.
EOF
```

#### Gemini 前端诊断
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
{{读取 prompts/gemini/debugger.md 的内容}}
</ROLE>

<TASK>
Debug: <问题描述>

Context:
<相关代码>
</TASK>

OUTPUT: Structured diagnostic report. No code modifications.
EOF
```

### Phase 3: 假设整合

1. 收集两个模型的诊断报告（使用 `TaskOutput`）
2. 交叉验证：识别重叠和互补的假设
3. **UltraThink 综合**：
   - 整合所有假设，按可能性排序
   - 筛选出 **Top 1-2 最可能原因**
   - 设计验证策略

### Phase 4: 用户确认（Hard Stop）

输出格式：
```
## 🔍 诊断结果

### Codex 分析（后端视角）
<Codex 诊断摘要>

### Gemini 分析（前端视角）
<Gemini 诊断摘要>

### 综合诊断
**最可能原因**：<具体诊断>
**证据**：<支持证据>
**验证方案**：<如何确认>

---
**确认后我将执行修复。是否继续？(Y/N)**
```

⚠️ **必须等待用户确认后才能进入 Phase 5**

### Phase 5: 修复与验证

1. 根据确认的诊断实施修复
2. 修复完成后，**强制并行调用** Codex + Gemini 审查修复
3. 综合审查意见，确认问题解决

## 输出格式

```
## Phase 1: 上下文检索
- 检索到 X 个相关文件
- 问题类型: [前端/后端/全栈]

## Phase 2: 并行诊断
### Codex 诊断
<诊断内容>

### Gemini 诊断
<诊断内容>

## Phase 3: 综合分析
### Top 假设
1. [最可能原因] - 可能性: High
2. [次可能原因] - 可能性: Medium

### 验证策略
- [具体验证步骤]

## Phase 4: 确认
**是否按此诊断进行修复？(Y/N)**

## Phase 5: 修复验证（用户确认后）
- 修复内容: <具体修改>
- 双模型审查: <审查结果>
```

## 关键原则

1. **不假设，先验证** - 所有假设需要证据支持
2. **并行诊断** - 充分利用双模型的不同视角
3. **用户确认** - 修复前必须获得确认
4. **交叉审查** - 修复后双模型验证
