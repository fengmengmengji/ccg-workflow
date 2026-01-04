# CCG: 多模型协作系统

<div align="center">

**Claude Code + Codex + Gemini 多模型协作工作流系统**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-green.svg)](https://claude.ai/code)

</div>

---

## 核心特性

| 特性 | 描述 |
|------|------|
| **智能路由** | 前端任务自动路由到 Gemini，后端任务路由到 Codex |
| **双模型协作** | 同时调用 Codex + Gemini 进行交叉验证 |
| **Prompt 增强** | 内置 Auggie prompt-enhancer，自动优化需求描述 |
| **6阶段工作流** | Prompt增强 → 上下文检索 → 多模型分析 → 原型生成 → 代码实施 → 审计交付 |
| **一键安装** | 自动编译、自动 patch Auggie MCP、自动配置 |
| **跨平台** | 支持 macOS、Linux、Windows |

---

## 快速开始

### 前置要求

- Python 3.8+
- Claude Code CLI
- Auggie MCP（安装脚本会自动 patch）
- Codex CLI / Gemini CLI

> **注意**：不需要安装 Go，已提供预编译二进制文件

### 安装

**一键安装（推荐）：**
```bash
git clone https://github.com/fengshao1227/ccg-workflow.git
cd ccg-workflow
python3 install.py
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/fengshao1227/ccg-workflow.git
cd ccg-workflow
python install.py
```

安装脚本会自动：
1. ✅ 安装核心工作流指令
2. ✅ 安装 17 个斜杠命令（`/ccg:xxx` 格式）
3. ✅ 编译 codeagent-wrapper（或使用预编译二进制）
4. ✅ Patch Auggie MCP（启用 prompt-enhancer，自动备份原文件）

### 使用

```bash
# 完整的多模型开发工作流（含 Prompt 增强）
/ccg:dev "实现用户认证功能"

# 智能路由代码生成
/ccg:code "添加用户注册表单"

# UltraThink 调试
/ccg:debug "登录接口返回 500 错误"

# 多模型测试生成
/ccg:test "为用户服务添加单元测试"

# 质量门控修复（90%+ 通过）
/ccg:bugfix "密码重置邮件发送失败"

# 深度分析
/ccg:think "评估微服务拆分方案"

# 性能优化
/ccg:optimize "优化首页加载速度"

# 前端任务 → Gemini
/ccg:frontend "创建登录表单组件"

# 后端任务 → Codex
/ccg:backend "实现 JWT 认证中间件"

# 双模型代码审查（无参数自动审查 git diff）
/ccg:review

# 双模型分析
/ccg:analyze "这个架构有什么问题？"

# 单独使用 Prompt 增强
/ccg:enhance "实现用户认证功能"

# Git 智能提交
/ccg:commit --emoji

# 交互式回滚
/ccg:rollback --branch main --target v1.0.0

# 清理已合并分支
/ccg:clean-branches --dry-run

# 创建 Worktree 并用 IDE 打开
/ccg:worktree add feature-ui -o

# 初始化项目 AI 上下文
/ccg:init "我的项目"
```

---

## 命令列表

### 开发工作流

| 命令 | 用途 | 模型路由 |
|------|------|----------|
| `/ccg:dev` | 完整6阶段开发工作流（含Prompt增强） | Auggie + Codex + Gemini |
| `/ccg:code` | 多模型代码生成（智能路由） | 前端→Gemini / 后端→Codex |
| `/ccg:debug` | UltraThink 多模型调试 | Codex + Gemini 并行诊断 |
| `/ccg:test` | 多模型测试生成 | Codex 后端测试 + Gemini 前端测试 |
| `/ccg:bugfix` | 质量门控修复（90%+ 通过） | 双模型交叉验证 |
| `/ccg:think` | 深度分析 | 双模型并行分析 |
| `/ccg:optimize` | 性能优化 | Codex 后端 + Gemini 前端 |
| `/ccg:frontend` | 前端/UI/样式任务 | Gemini |
| `/ccg:backend` | 后端/逻辑/算法任务 | Codex |
| `/ccg:review` | 代码审查（无参数自动审查 git diff） | Codex + Gemini |
| `/ccg:analyze` | 技术分析 | Codex + Gemini |
| `/ccg:enhance` | Prompt 增强 | Auggie MCP |

### Git 工具

| 命令 | 用途 |
|------|------|
| `/ccg:commit` | 智能 commit：分析改动、生成 conventional commit 信息、支持 emoji |
| `/ccg:rollback` | 交互式回滚：列分支、列版本、二次确认后执行 reset/revert |
| `/ccg:clean-branches` | 清理分支：安全查找并清理已合并或过期的分支 |
| `/ccg:worktree` | Worktree 管理：在 `../.ccg/项目名/` 下创建，支持 IDE 集成 |

### 项目初始化

| 命令 | 用途 |
|------|------|
| `/ccg:init` | 初始化项目 AI 上下文，生成根级与模块级 CLAUDE.md 索引 |

---

## 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                   /ccg:dev 工作流                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 0: Prompt 增强 (Auggie prompt-enhancer)              │
│      ↓                                                      │
│  Phase 1: 上下文检索 (Auggie codebase-retrieval)            │
│      ↓                                                      │
│  Phase 2: 多模型分析 (Codex ∥ Gemini) ← 并行执行            │
│      ↓                                                      │
│  Phase 3: 原型生成                                           │
│      ├── 前端任务 → Gemini                                  │
│      └── 后端任务 → Codex                                   │
│      ↓                                                      │
│  Phase 4: 代码实施 (Claude 重构为生产级代码)                 │
│      ↓                                                      │
│  Phase 5: 审计交付 (Codex ∥ Gemini) ← 并行审查              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 项目结构

```
ccg/
├── bin/                         # 预编译二进制文件
│   ├── codeagent-wrapper-darwin-amd64
│   ├── codeagent-wrapper-darwin-arm64
│   ├── codeagent-wrapper-linux-amd64
│   └── codeagent-wrapper-windows-amd64.exe
├── codeagent-wrapper/           # Go 多后端调用工具源码
│   ├── main.go
│   ├── backend.go
│   └── ...
├── commands/
│   └── ccg/                     # /ccg:xxx 命令命名空间
│       ├── dev.md               # /ccg:dev 完整工作流
│       ├── code.md              # /ccg:code 多模型代码生成
│       ├── debug.md             # /ccg:debug UltraThink 调试
│       ├── test.md              # /ccg:test 多模型测试生成
│       ├── bugfix.md            # /ccg:bugfix 质量门控修复
│       ├── think.md             # /ccg:think 深度分析
│       ├── optimize.md          # /ccg:optimize 性能优化
│       ├── frontend.md          # /ccg:frontend 前端任务
│       ├── backend.md           # /ccg:backend 后端任务
│       ├── review.md            # /ccg:review 代码审查
│       ├── analyze.md           # /ccg:analyze 技术分析
│       ├── enhance.md           # /ccg:enhance Prompt 增强
│       ├── commit.md            # /ccg:commit 智能提交
│       ├── rollback.md          # /ccg:rollback 交互式回滚
│       ├── clean-branches.md    # /ccg:clean-branches 清理分支
│       ├── worktree.md          # /ccg:worktree 管理
│       └── init.md              # /ccg:init 项目初始化
├── prompts/
│   ├── codex/                  # Codex 角色提示词
│   │   ├── architect.md        # 后端架构师（代码生成）
│   │   ├── analyzer.md         # 技术分析师
│   │   ├── debugger.md         # 调试专家
│   │   ├── tester.md           # 测试工程师
│   │   ├── reviewer.md         # 代码审查员
│   │   └── optimizer.md        # 性能优化专家
│   └── gemini/                 # Gemini 角色提示词
│       ├── frontend.md         # 前端开发专家（代码生成）
│       ├── analyzer.md         # 设计分析师
│       ├── debugger.md         # UI调试专家
│       ├── tester.md           # 前端测试工程师
│       ├── reviewer.md         # UI审查员
│       └── optimizer.md        # 前端性能优化专家
├── patches/
│   └── augment-enhanced.mjs     # Auggie MCP 补丁（含 prompt-enhancer）
├── memorys/
│   └── CLAUDE.md                # 核心工作流指令
├── config.json                  # 安装配置
├── install.py                   # 安装脚本
└── README.md
```

---

## 安装选项

```bash
# 查看可用模块
python3 install.py --list-modules

# 详细输出
python3 install.py --verbose

# 自定义安装目录
python3 install.py --install-dir ~/.claude
```

---

## 调用语法

**HEREDOC 语法（推荐）**：
```bash
codeagent-wrapper --backend <codex|gemini|claude> - [工作目录] <<'EOF'
<任务内容>
EOF
```

**简单任务**：
```bash
codeagent-wrapper --backend codex "简单任务" [工作目录]
```

**恢复会话**：
```bash
codeagent-wrapper --backend codex resume <session_id> - <<'EOF'
<后续任务>
EOF
```

---

## 并行执行

使用 Claude Code 的 `run_in_background: true` 参数实现非阻塞并行：

```
# 启动后台任务（非阻塞）
Bash(run_in_background=true): codeagent-wrapper --backend codex ...
Bash(run_in_background=true): codeagent-wrapper --backend gemini ...

# 获取结果
TaskOutput: task_id=<task_id>
```

---

## 安全机制

- **零写入权限**：Codex/Gemini 对文件系统无写入权限
- **Unified Diff**：所有外部模型输出必须为 Unified Diff Patch 格式
- **脏原型处理**：外部模型输出视为"脏原型"，需经 Claude 重构
- **自动备份**：Patch Auggie MCP 时自动备份原文件

---

## 模型分工

| 模型 | 擅长领域 | 使用场景 |
|------|----------|----------|
| **Gemini** | 前端、UI/UX、视觉设计 | CSS、React、Vue 组件 |
| **Codex** | 后端、算法、调试 | API、业务逻辑、性能优化 |
| **Claude** | 编排、重构、交付 | 工作流控制、代码审核 |
| **Auggie** | 代码检索、Prompt 增强 | 上下文获取、需求优化 |

---

## 专家系统提示词

调用外部模型时动态注入相应的角色设定，确保输出质量和一致性。

### 角色文件结构

每个命令根据任务类型注入不同的角色提示词：

| 命令 | Codex 角色 | Gemini 角色 |
|------|-----------|-------------|
| `/ccg:code`, `/ccg:backend` | `prompts/codex/architect.md` | - |
| `/ccg:frontend` | - | `prompts/gemini/frontend.md` |
| `/ccg:analyze`, `/ccg:think`, `/ccg:dev` | `prompts/codex/analyzer.md` | `prompts/gemini/analyzer.md` |
| `/ccg:debug` | `prompts/codex/debugger.md` | `prompts/gemini/debugger.md` |
| `/ccg:test` | `prompts/codex/tester.md` | `prompts/gemini/tester.md` |
| `/ccg:review`, `/ccg:bugfix` | `prompts/codex/reviewer.md` | `prompts/gemini/reviewer.md` |
| `/ccg:optimize` | `prompts/codex/optimizer.md` | `prompts/gemini/optimizer.md` |

### 动态角色注入

命令执行时，将角色文件内容注入到 `<ROLE>` 标签中：

```bash
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
# 读取 prompts/codex/architect.md 的内容并注入
</ROLE>

<TASK>
实现后端逻辑: <任务描述>

Context:
<相关代码>
</TASK>

OUTPUT: Unified Diff Patch ONLY.
EOF
```

### 完整提示词文件

- **Codex 角色**: `prompts/codex/` 目录下的 6 个文件
- **Gemini 角色**: `prompts/gemini/` 目录下的 6 个文件

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

Copyright (c) 2025 fengshao1227

---

## 致谢

- **[cexll/myclaude](https://github.com/cexll/myclaude)** - codeagent-wrapper 多后端调用工具的 Go 代码来源
- **[UfoMiao/zcf](https://github.com/UfoMiao/zcf)** - Git 工具（commit、rollback、clean-branches、worktree）和项目初始化（init）命令来源
- **[GudaStudio/skills](https://github.com/GuDaStudio/skills)** - 智能路由（前端→Gemini、后端→Codex）的设计理念
- **[linux.do 社区](https://linux.do/t/topic/1280612)** - Auggie MCP prompt-enhancer 补丁
