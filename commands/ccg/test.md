---
description: 多模型测试生成（Codex 后端测试 + Gemini 前端测试）
---

# /ccg:test - 多模型测试生成

## Usage
`/ccg:test <测试目标>`

## Context
- 测试目标: $ARGUMENTS
- 使用 Auggie 检索目标代码和现有测试
- Codex 生成后端测试，Gemini 生成前端测试

## 工作流程

### Phase 1: 测试分析

1. 调用 `mcp__auggie-mcp__codebase-retrieval` 检索：
   - 目标代码的完整实现
   - 现有测试文件和测试框架
   - 项目测试配置（jest.config, pytest.ini 等）
2. 识别代码类型：前端组件 / 后端逻辑 / 全栈
3. 评估当前测试覆盖率和缺口

### Phase 2: 智能路由测试生成

根据代码类型选择路由：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

#### Route A: 后端代码 → Codex
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/tester.md 的内容并注入
</ROLE>

<TASK>
Generate tests for: <测试目标>

Context:
<目标代码>
<现有测试样例>
</TASK>

OUTPUT: Unified Diff Patch for test files ONLY.
EOF
```

#### Route B: 前端代码 → Gemini
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/tester.md 的内容并注入
</ROLE>

<TASK>
Generate tests for: <测试目标>

Context:
<目标代码>
<现有测试样例>
</TASK>

OUTPUT: Unified Diff Patch for test files ONLY.
EOF
```

#### Route C: 全栈 → 并行生成
同时启动 Codex (后端测试) + Gemini (前端测试)，使用 `run_in_background: true`

### Phase 3: 测试整合

1. 收集模型输出（使用 `TaskOutput`）
2. 将 Unified Diff 视为"脏原型"
3. Claude 重构：
   - 统一测试风格
   - 确保命名一致性
   - 优化测试结构
   - 移除冗余测试

### Phase 4: 测试验证

1. 运行生成的测试
2. 检查测试通过率
3. 如有失败，分析原因并修复

## 输出格式

```
## Phase 1: 测试分析
- 目标代码: <文件列表>
- 代码类型: [前端/后端/全栈]
- 现有测试: <测试文件列表>
- 测试框架: [Jest/Pytest/Vitest/...]
- 覆盖率缺口: <识别的缺口>

## Phase 2: 测试生成
### [Codex/Gemini] 生成的测试
<Unified Diff 摘要>

## Phase 3: 测试整合
<重构后的测试代码>

## Phase 4: 验证
- 测试运行结果: [PASS/FAIL]
- 覆盖率变化: X% → Y%

## 生成的测试文件
- <file1.test.ts>
- <file2.spec.py>
```

## 测试策略金字塔

```
        /\
       /  \      E2E Tests (少量)
      /----\
     /      \    Integration Tests (适量)
    /--------\
   /          \  Unit Tests (大量)
  --------------
```

- **Unit Tests**: 70% - 快速、隔离、聚焦
- **Integration Tests**: 20% - 组件交互、API 测试
- **E2E Tests**: 10% - 关键用户流程

## 关键原则

1. **测试行为，不测试实现** - 关注输入输出，不关注内部细节
2. **智能路由** - 后端测试用 Codex，前端测试用 Gemini
3. **复用现有模式** - 遵循项目已有的测试风格
4. **覆盖优先级** - 先覆盖关键路径和高风险代码
