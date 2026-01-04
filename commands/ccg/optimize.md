---
description: 多模型性能优化（Codex 后端优化 + Gemini 前端优化）
---

# /ccg:optimize - 性能优化

## Usage
`/ccg:optimize <优化目标>`

## Context
- 优化目标: $ARGUMENTS
- Codex 专注后端性能（数据库、算法、缓存）
- Gemini 专注前端性能（渲染、加载、交互）

## 工作流程

### Phase 1: 性能基线分析

1. 调用 `mcp__auggie-mcp__codebase-retrieval` 检索目标代码
2. 识别性能关键路径
3. 收集现有指标（如有）：
   - 后端: 响应时间、查询耗时、内存占用
   - 前端: LCP、FID、CLS、Bundle Size

### Phase 2: 并行性能分析

**同时启动（`run_in_background: true`）**：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

#### Codex 后端性能分析
```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/optimizer.md 的内容并注入
</ROLE>

<TASK>
Performance optimization for: <优化目标>

Context:
<相关代码>
</TASK>

OUTPUT: Analysis report + Unified Diff Patch for optimizations.
EOF
```

#### Gemini 前端性能分析
```bash
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/optimizer.md 的内容并注入
</ROLE>

<TASK>
Performance optimization for: <优化目标>

Context:
<相关代码>
</TASK>

OUTPUT: Analysis report + Unified Diff Patch for optimizations.
EOF
```

### Phase 3: 优化整合

1. 收集双模型分析（使用 `TaskOutput`）
2. **优先级排序**：
   - 按影响程度排序（High/Medium/Low）
   - 按实施难度评估
   - 综合性价比排序
3. Claude 重构优化代码

### Phase 4: 实施优化

1. 按优先级实施优化
2. 确保不破坏现有功能
3. 添加必要的性能监控

### Phase 5: 验证

1. 运行性能测试（如有）
2. 对比优化前后指标
3. 双模型审查优化效果

## 输出格式

```
## ⚡ 性能优化: <优化目标>

### Phase 1: 基线分析
- 优化范围: <涉及的模块>
- 当前指标: <现有性能数据>
- 关键路径: <性能热点>

### Phase 2: 性能分析

#### Codex 分析（后端）
| 问题 | 影响 | 难度 | 预期提升 |
|------|------|------|----------|
| <问题1> | High | Low | -200ms |
| <问题2> | Medium | Medium | -50ms |

**优化建议**:
1. <建议1>
2. <建议2>

#### Gemini 分析（前端）
| 问题 | 影响 | 难度 | 预期提升 |
|------|------|------|----------|
| <问题1> | High | Low | -1.5s LCP |
| <问题2> | Medium | Low | -100KB |

**优化建议**:
1. <建议1>
2. <建议2>

### Phase 3: 优化计划

#### 优先级排序
| 排序 | 优化项 | 来源 | 性价比 |
|------|--------|------|--------|
| 1 | <优化1> | Codex | ⭐⭐⭐ |
| 2 | <优化2> | Gemini | ⭐⭐⭐ |
| 3 | <优化3> | Codex | ⭐⭐ |

### Phase 4: 实施
<优化代码变更>

### Phase 5: 验证
| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 响应时间 | 500ms | 200ms | 60% |
| Bundle Size | 2MB | 1.2MB | 40% |
| LCP | 3.5s | 1.8s | 49% |

### 结果
✅ 优化完成
- 后端优化: X 项
- 前端优化: Y 项
- 综合提升: Z%
```

## 性能指标参考

### 后端指标
| 指标 | 良好 | 需优化 | 严重 |
|------|------|--------|------|
| API 响应 | <100ms | 100-500ms | >500ms |
| 数据库查询 | <50ms | 50-200ms | >200ms |
| 内存占用 | 稳定 | 缓慢增长 | 快速增长 |

### 前端指标 (Core Web Vitals)
| 指标 | 良好 | 需改进 | 差 |
|------|------|--------|-----|
| LCP | <2.5s | 2.5-4s | >4s |
| FID | <100ms | 100-300ms | >300ms |
| CLS | <0.1 | 0.1-0.25 | >0.25 |

## 常见优化模式

### 后端
- **N+1 查询** → 批量加载 / JOIN
- **缺少索引** → 添加复合索引
- **重复计算** → 缓存 / Memoization
- **同步阻塞** → 异步处理

### 前端
- **大 Bundle** → 代码分割 / 懒加载
- **频繁重渲染** → React.memo / useMemo
- **大列表** → 虚拟滚动
- **未优化图片** → WebP / 懒加载

## 关键原则

1. **先测量后优化** - 没有数据不盲目优化
2. **性价比优先** - 高影响 + 低难度优先
3. **不破坏功能** - 优化不能引入 bug
4. **可观测性** - 添加监控便于持续优化
