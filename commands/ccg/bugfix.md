---
description: 质量门控修复（双模型交叉验证，90%+ 通过）
---

# /ccg:bugfix - 质量门控修复

## Usage
`/ccg:bugfix <bug描述>`

## Context
- Bug 描述: $ARGUMENTS
- 使用双模型交叉验证确保修复质量
- 质量门控：90%+ 评分才能通过，最多 3 轮迭代

## 工作流程

### Phase 1: Bug 分析

1. 调用 `mcp__auggie-mcp__codebase-retrieval` 检索相关代码
2. 分析 bug 类型：前端/后端/全栈
3. 收集复现步骤、错误日志、预期行为

### Phase 2: 双模型诊断

**并行启动（`run_in_background: true`）**：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

#### Codex 分析
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/architect.md 的内容并注入
</ROLE>

<TASK>
Bugfix: <bug描述>

Context:
<相关代码>

Requirements:
1. Identify root cause with evidence
2. Propose fix with minimal code changes
3. Assess potential side effects
4. Recommend regression tests
</TASK>

OUTPUT: Unified Diff Patch for the fix.
EOF
```

#### Gemini 分析
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/frontend.md 的内容并注入
</ROLE>

<TASK>
Bugfix: <bug描述>

Context:
<相关代码>

Requirements:
1. Identify root cause with evidence
2. Propose fix with minimal code changes
3. Check UI/UX impact
4. Recommend user-facing tests
</TASK>

OUTPUT: Unified Diff Patch for the fix.
EOF
```

### Phase 3: 修复整合

1. 收集双模型的修复方案
2. 综合分析：
   - 识别共同修复点
   - 合并互补的修复
   - 选择最优方案
3. Claude 重构为生产级代码

### Phase 4: 实施修复

1. 应用修复代码
2. 记录变更内容

### Phase 5: 质量门控验证

**并行启动双模型验证（`run_in_background: true`）**：

**注意**：调用前先读取对应角色提示词文件（reviewer），将内容注入到 `<ROLE>` 标签中。

#### Codex 验证
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/reviewer.md 的内容并注入
</ROLE>

<TASK>
Validate bugfix for: <bug描述>

Original bug:
<bug描述>

Applied fix:
<修复的 diff>
</TASK>

OUTPUT: Use the scoring format defined in the role.
EOF
```

#### Gemini 验证
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/reviewer.md 的内容并注入
</ROLE>

<TASK>
Validate bugfix for: <bug描述>

Original bug:
<bug描述>

Applied fix:
<修复的 diff>
</TASK>

OUTPUT: Use the scoring format defined in the role.
EOF
```

### Phase 6: 质量门控决策

```
综合评分 = (Codex 评分 + Gemini 评分) / 2
```

#### 评分 ≥ 90%: 通过
```
✅ 质量门控通过
- Codex 评分: XX/100
- Gemini 评分: XX/100
- 综合评分: XX/100

修复已完成，可以提交。
```

#### 评分 < 90%: 迭代修复
```
⚠️ 质量门控未通过 (第 N/3 轮)
- Codex 评分: XX/100
- Gemini 评分: XX/100
- 综合评分: XX/100

需要改进的问题:
1. <Codex 指出的问题>
2. <Gemini 指出的问题>

正在进行第 N+1 轮修复...
```

返回 Phase 3，携带反馈进行迭代（最多 3 轮）

#### 3 轮后仍未通过
```
❌ 质量门控失败（已达最大迭代次数）
- 最终评分: XX/100
- 未解决的问题: <问题列表>

建议: 需要人工介入审查
```

## 输出格式

```
## 🐛 Bugfix: <bug描述>

### Phase 1: 分析
- Bug 类型: [前端/后端/全栈]
- 影响范围: <影响的文件/模块>

### Phase 2: 诊断
#### Codex 诊断
- 根因: <分析结果>

#### Gemini 诊断
- 根因: <分析结果>

### Phase 3-4: 修复
<修复代码>

### Phase 5: 验证 (第 N 轮)
| 检查项 | Codex | Gemini |
|--------|-------|--------|
| 项目1  | XX/20 | XX/20  |
| ...    | ...   | ...    |
| **总分** | **XX/100** | **XX/100** |

**综合评分: XX/100**

### 结果
[✅ 通过 / ⚠️ 迭代中 / ❌ 需人工介入]
```

## 质量门控规则

| 综合评分 | 结果 | 动作 |
|----------|------|------|
| ≥ 90% | ✅ PASS | 完成修复，可提交 |
| 70-89% | ⚠️ ITERATE | 返回修复，携带反馈 |
| < 70% | ⚠️ ITERATE | 返回修复，重点关注问题 |
| 3轮后 < 90% | ❌ FAIL | 需人工介入 |

## 关键原则

1. **双模型交叉验证** - 避免单一视角的盲区
2. **量化质量评估** - 使用评分制而非主观判断
3. **迭代改进** - 每轮携带具体反馈
4. **止损机制** - 最多 3 轮，防止无限循环
