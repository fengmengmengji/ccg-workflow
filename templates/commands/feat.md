---
name: ccg:feat
description: 🚀 智能功能开发 - 自动规划、设计、实施
tools: Task, Read, Write, Bash, AskUserQuestion, Glob
---

# CCG 智能功能开发

智能识别用户输入类型，自动选择工作流：
- **需求规划**：需求分析 → 任务分解 → 生成计划文档
- **讨论迭代**：基于现有计划调整优化
- **执行实施**：按计划调用多模型实施开发

---

## 执行流程

### 步骤 1：输入类型识别

分析用户输入，识别关键词：

#### 1.1 需求规划模式（默认）
**关键词**：实现、开发、新增、添加、构建、需求、设计、规划
**示例**："实现用户登录功能"、"开发商品管理模块"
**执行**：→ 步骤 2（完整规划）

#### 1.2 讨论迭代模式
**关键词**：调整、修改、优化、改进、更新、重新规划、包含计划文件路径
**示例**："调整登录功能方案"、"优化 .claude/plan/登录功能.md"
**执行**：→ 读取现有计划 → 步骤 2.4（重新规划）

#### 1.3 执行实施模式
**关键词**：开始实施、执行计划、按照计划、根据计划
**示例**："开始实施登录功能"、"按照 .claude/plan/登录功能.md 开发"
**执行**：→ 步骤 3（直接实施）

---

### 步骤 2：需求规划流程

#### 2.1 上下文检索

调用 mcp__ace-tool__search_context 检索相关代码：

```
mcp__ace-tool__search_context {
  "query": "{{用户需求关键词}} + 相关代码实现、API、组件、数据模型、技术栈"
}
```

**期望结果**：现有代码位置、可复用组件、数据模型、API 结构、技术栈

---

#### 2.2 任务类型判断

基于用户需求和检索结果：

| 任务类型 | 判断依据 | 调用流程 |
|----------|----------|----------|
| **前端** | 页面、组件、UI、样式、布局 | ui-ux-designer → planner |
| **后端** | API、接口、数据库、逻辑、算法 | planner |
| **全栈** | 同时包含前后端 | ui-ux-designer → planner |

---

#### 2.3 调用 ui-ux-designer（前端/全栈）

如果是前端或全栈任务：

```bash
Task(subagent_type="general-purpose", description="调用 UI/UX 设计师") {
  prompt: "
执行 agent: ~/.claude/agents/ccg/ui-ux-designer.md

项目上下文: {{MCP 检索结果}}
用户需求: {{原始需求}}
技术栈: {{从检索结果提取}}

输出: UI/UX 设计方案（Markdown）
"
}
```

---

#### 2.4 调用 planner

```bash
Task(subagent_type="general-purpose", description="调用任务规划师") {
  prompt: "
执行 agent: ~/.claude/agents/ccg/planner.md

项目上下文: {{MCP 检索结果}}
{{如果有 UI/UX 设计方案，附加在此}}
用户需求: {{原始需求}}
技术栈: {{从检索结果提取}}

输出: 生成功能规划文档并保存到 .claude/plan/{{功能名}}.md
"
}
```

---

#### 2.5 计划版本控制

**首次规划**：
```bash
FEATURE_NAME="{{从需求提取的功能名}}"
PLAN_FILE=".claude/plan/${FEATURE_NAME}.md"

if [ -f "$PLAN_FILE" ]; then
  PLAN_FILE=".claude/plan/${FEATURE_NAME}-1.md"
fi
```

**讨论迭代**：
```bash
EXISTING_PLAN=$(find .claude/plan -name "*{{关键词}}*.md" | head -n 1)

if [ -n "$EXISTING_PLAN" ]; then
  BASE_NAME=$(basename "$EXISTING_PLAN" .md)
  if [[ $BASE_NAME =~ -([0-9]+)$ ]]; then
    VERSION=$((${BASH_REMATCH[1]} + 1))
    NEW_PLAN=".claude/plan/${BASE_NAME%-*}-${VERSION}.md"
  else
    NEW_PLAN=".claude/plan/${BASE_NAME}-1.md"
  fi
fi
```

---

#### 2.6 交互确认

```bash
AskUserQuestion {
  question: "功能规划已完成，请选择下一步操作：",
  header: "下一步",
  options: [
    { label: "开始实施（推荐）", description: "根据计划调用多模型开发" },
    { label: "讨论调整", description: "修改计划中的某些部分" },
    { label: "重新规划", description: "推翻当前方案重新开始" },
    { label: "仅保存计划", description: "暂不实施，稍后手动执行" }
  ]
}
```

**处理逻辑**：
- 开始实施 → 步骤 3
- 讨论调整 → 重新执行步骤 2.4
- 重新规划 → 删除当前计划，重新执行步骤 2
- 仅保存计划 → 退出

---

### 步骤 3：执行实施

#### 3.1 读取计划文档

```bash
if [[ "$USER_INPUT" =~ \.claude/plan/.*\.md ]]; then
  PLAN_FILE="{{用户指定路径}}"
else
  PLAN_FILE=$(ls -t .claude/plan/*.md | head -n 1)
fi

PLAN_CONTENT=$(Read("$PLAN_FILE"))
```

---

#### 3.2 任务类型分析

从计划提取分类：

```bash
FRONTEND_TASKS=$(echo "$PLAN_CONTENT" | grep -E "模块.*：前端" || echo "")
BACKEND_TASKS=$(echo "$PLAN_CONTENT" | grep -E "模块.*：后端" || echo "")

if [ -n "$FRONTEND_TASKS" ] && [ -n "$BACKEND_TASKS" ]; then
  TASK_TYPE="fullstack"
elif [ -n "$FRONTEND_TASKS" ]; then
  TASK_TYPE="frontend"
elif [ -n "$BACKEND_TASKS" ]; then
  TASK_TYPE="backend"
fi
```

如无法判断，询问用户选择任务类型。

---

#### 3.3 多模型路由实施

##### 前端任务 → {{FRONTEND_PRIMARY}}

```bash
if [ "$TASK_TYPE" == "frontend" ] || [ "$TASK_TYPE" == "fullstack" ]; then
  FRONTEND_PLAN=$(echo "$PLAN_CONTENT" | sed -n '/模块.*：前端/,/模块.*：/p')

  codeagent-wrapper --backend {{FRONTEND_PRIMARY}} - "$PROJECT_DIR" <<'EOF'
ROLE_FILE: ~/.claude/.ccg/prompts/{{FRONTEND_PRIMARY}}/frontend.md

<TASK>
根据以下计划实施前端功能：
$FRONTEND_PLAN

要求：
1. 创建/修改所有需要的组件文件
2. 符合项目代码风格
3. 实现响应式设计
4. 添加 TypeScript 类型定义
5. 处理 Loading/Success/Error 状态
6. 遵循无障碍访问最佳实践
</TASK>
EOF

  GEMINI_SESSION=$(echo "$OUTPUT" | grep "SESSION_ID:" | awk '{print $2}')
fi
```

##### 后端任务 → {{BACKEND_PRIMARY}}

```bash
if [ "$TASK_TYPE" == "backend" ] || [ "$TASK_TYPE" == "fullstack" ]; then
  BACKEND_PLAN=$(echo "$PLAN_CONTENT" | sed -n '/模块.*：后端/,/模块.*：/p')

  codeagent-wrapper --backend {{BACKEND_PRIMARY}} - "$PROJECT_DIR" <<'EOF'
ROLE_FILE: ~/.claude/.ccg/prompts/{{BACKEND_PRIMARY}}/architect.md

<TASK>
根据以下计划实施后端功能：
$BACKEND_PLAN

要求：
1. 创建/修改所有 API 端点
2. 实现数据验证（Zod/Joi）
3. 统一错误处理
4. 添加中间件（认证、日志、CORS）
5. 编写数据库查询
6. 确保代码可测试性
</TASK>
EOF

  CODEX_SESSION=$(echo "$OUTPUT" | grep "SESSION_ID:" | awk '{print $2}')
fi
```

##### 全栈任务 → 并行调用

```bash
if [ "$TASK_TYPE" == "fullstack" ]; then
  { 前端任务 } &
  { 后端任务 } &
  wait
fi
```

---

#### 3.4 实施后验证

```bash
git status --short
git diff --name-status

AskUserQuestion {
  question: "是否运行代码审查？",
  options: [
    { label: "是，运行 /ccg:review", description: "双模型代码审查" },
    { label: "跳过，手动检查", description: "稍后自行审查代码" }
  ]
}
```

如果用户选择审查，调用 `/ccg:review`。

---

### 步骤 4：后续建议

```bash
echo "✅ 功能开发完成！"
echo ""
echo "📋 后续步骤："
echo "  1. 运行测试：npm run test"
echo "  2. 启动开发服务器：npm run dev"
echo "  3. 验证功能是否正常"
echo "  4. 运行 /ccg:commit 提交代码"
echo ""
echo "📂 计划文档：$PLAN_FILE"
```

---

## 命令参数

```bash
/ccg:feat --mode=plan "实现用户登录"        # 显式指定规划模式
/ccg:feat --mode=implement "path/to/plan"   # 显式指定实施模式
/ccg:feat --mode=iterate "path" "调整需求"  # 显式指定迭代模式
/ccg:feat --type=frontend "实现登录页面"    # 指定任务类型
/ccg:feat --type=backend "实现登录 API"
/ccg:feat --type=fullstack "实现完整登录"
```

---

## 使用示例

```bash
# 示例 1：完整流程
/ccg:feat 实现用户登录功能

→ 系统识别：需求规划模式
→ 检索上下文（MCP）
→ 判断任务类型：全栈
→ 调用 ui-ux-designer
→ 调用 planner
→ 生成计划：.claude/plan/用户登录功能.md
→ 用户确认：开始实施
→ 并行调用 Gemini（前端）+ Codex（后端）
→ 实施完成
→ 可选：运行代码审查

# 示例 2：讨论迭代
/ccg:feat 调整登录功能，增加"记住我"选项

→ 系统识别：讨论迭代模式
→ 读取现有计划：.claude/plan/用户登录功能.md
→ 调用 planner 重新规划
→ 生成新版本：.claude/plan/用户登录功能-1.md

# 示例 3：直接实施
/ccg:feat 按照 .claude/plan/用户登录功能.md 开始实施

→ 系统识别：执行实施模式
→ 读取计划文档
→ 分析任务类型：全栈
→ 并行调用 Gemini + Codex
→ 实施完成
```

---

现在开始智能功能开发！
