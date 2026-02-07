# CCG - Claude + Codex + Gemini Multi-Model Collaboration

<div align="center">

[![npm version](https://img.shields.io/npm/v/ccg-workflow.svg)](https://www.npmjs.com/package/ccg-workflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-green.svg)](https://claude.ai/code)

</div>

Claude Code 编排 Codex + Gemini 的多模型协作开发系统。前端任务路由至 Gemini，后端任务路由至 Codex，Claude 负责编排决策和代码审核。

## 安装

```bash
npx ccg-workflow
```

**要求**：Claude Code CLI、Node.js 20+

> **重要**：本项目依赖 `ora@9.x` 和 `string-width@8.x`，这些包要求 Node.js >= 20。使用 Node.js 18 会导致 `SyntaxError: Invalid regular expression flags` 错误。请确保升级到 Node.js 20 或更高版本。

**可选**：Codex CLI（后端）、Gemini CLI（前端）

## 命令

| 命令 | 说明 |
|------|------|
| `/ccg:workflow` | 6 阶段完整工作流 |
| `/ccg:plan` | 多模型协作规划 (Phase 1-2) |
| `/ccg:execute` | 多模型协作执行 (Phase 3-5) |
| `/ccg:feat` | 新功能开发 |
| `/ccg:frontend` | 前端任务 (Gemini) |
| `/ccg:backend` | 后端任务 (Codex) |
| `/ccg:analyze` | 技术分析 |
| `/ccg:debug` | 问题诊断 |
| `/ccg:optimize` | 性能优化 |
| `/ccg:test` | 测试生成 |
| `/ccg:review` | 代码审查 |
| `/ccg:commit` | Git 提交 |
| `/ccg:rollback` | Git 回滚 |
| `/ccg:clean-branches` | 清理分支 |
| `/ccg:worktree` | Worktree 管理 |
| `/ccg:init` | 初始化 CLAUDE.md |
| `/ccg:enhance` | Prompt 增强 |
| `/ccg:spec-init` | 初始化 OPSX 环境 |
| `/ccg:spec-research` | 需求 → 约束集 |
| `/ccg:spec-plan` | 约束 → 零决策计划 |
| `/ccg:spec-impl` | 按计划执行 + 归档 |
| `/ccg:spec-review` | 双模型交叉审查 |

### OPSX 规范驱动（v1.7.52+）

集成 [OPSX 架构](https://github.com/fission-ai/opsx)，把需求变成约束，让 AI 没法自由发挥：

```bash
# 初始化 OPSX 环境
/ccg:spec-init

# 研究需求 → 输出约束集
/ccg:spec-research 实现用户认证

# 并行分析 → 零决策计划
/ccg:spec-plan

# 按计划执行
/ccg:spec-impl

# 独立审查（随时可用）
/ccg:spec-review
```

**说明**：`/ccg:spec-*` 命令是 CCG 对 OPSX 的封装，内部调用 `/opsx:*` 命令。每阶段之间可 `/clear`，状态存在 `openspec/` 目录，不怕上下文爆。

### 规划与执行分离

v1.7.39 新增 `/ccg:plan` 和 `/ccg:execute` 命令，将规划与执行解耦：

```bash
# 1. 生成实施计划
/ccg:plan 实现用户认证功能

# 2. 审查计划（可修改）
# 计划保存至 .claude/plan/user-auth.md

# 3. 执行计划（新会话也可执行）
/ccg:execute .claude/plan/user-auth.md
```

## 配置

### 目录结构

```
~/.claude/
├── commands/ccg/       # 斜杠命令
├── agents/ccg/         # 子智能体
├── bin/codeagent-wrapper
└── .ccg/
    ├── config.toml
    └── prompts/{codex,gemini}/
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CODEAGENT_POST_MESSAGE_DELAY` | Codex 完成后等待时间（秒） | 5 |
| `CODEX_TIMEOUT` | codeagent-wrapper 执行超时（秒） | 7200 |
| `BASH_DEFAULT_TIMEOUT_MS` | Claude Code Bash 默认超时（毫秒） | 120000 |
| `BASH_MAX_TIMEOUT_MS` | Claude Code Bash 最大超时（毫秒） | 600000 |

配置方式（`~/.claude/settings.json`）：

```json
{
  "env": {
    "CODEAGENT_POST_MESSAGE_DELAY": "1",
    "CODEX_TIMEOUT": "7200",
    "BASH_DEFAULT_TIMEOUT_MS": "600000",
    "BASH_MAX_TIMEOUT_MS": "3600000",
    "GEMINI_API_KEY": "your-gemini-api-key",
    "GOOGLE_API_KEY": "your-google-api-key"
  }
}
```

> **VSCode 插件用户注意**：VSCode 启动的子进程不会继承终端环境变量，必须在 `settings.json` 中配置 API 密钥，否则 Gemini 会报退出码 41（授权失败）。

### MCP 配置

代码检索 MCP（二选一）：
- **ContextWeaver**（推荐）- 本地混合搜索，需要硅基流动 API Key（免费）
- **ace-tool**（收费）- Augment 官方，Token 获取：https://augmentcode.com/

辅助工具 MCP（可选）：
- **Context7** - 获取最新库文档
- **Playwright** - 浏览器自动化/测试
- **DeepWiki** - 知识库查询
- **Exa** - 搜索引擎（需 API Key）

```bash
# 配置 MCP
npx ccg-workflow menu  # 选择「配置 MCP」
```

## 实用工具

```bash
npx ccg-workflow menu  # 选择「实用工具」
```

- **ccusage** - Claude Code 用量分析
- **CCometixLine** - 状态栏工具（Git + 用量跟踪）

## 安装 Claude Code

```bash
npx ccg-workflow menu  # 选择「安装 Claude Code」
```

支持多种安装方式：npm、homebrew、curl、powershell、cmd

## 更新 / 卸载

```bash
# 更新
npx ccg-workflow@latest          # npx 用户
npm install -g ccg-workflow@latest  # npm 全局用户

# 卸载
npx ccg-workflow  # 选择 "卸载工作流"
npm uninstall -g ccg-workflow  # npm 全局用户需额外执行
```

## 已知问题

**Codex CLI 0.80.0 进程不退出**

`--json` 模式下 Codex 完成输出后进程不会自动退出。

解决：设置 `CODEAGENT_POST_MESSAGE_DELAY=1`

## 架构

```
Claude Code (编排)
       │
   ┌───┴───┐
   ↓       ↓
Codex   Gemini
(后端)   (前端)
   │       │
   └───┬───┘
       ↓
  Unified Patch
```

外部模型无写入权限，仅返回 Patch，由 Claude 审核后应用。

## 致谢

- [cexll/myclaude](https://github.com/cexll/myclaude) - codeagent-wrapper
- [UfoMiao/zcf](https://github.com/UfoMiao/zcf) - Git 工具
- [GudaStudio/skills](https://github.com/GuDaStudio/skills) - 路由设计
- [ace-tool](https://linux.do/t/topic/1344562) - MCP 工具

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=fengshao1227/ccg-workflow&type=timeline&legend=top-left)](https://www.star-history.com/#fengshao1227/ccg-workflow&type=timeline&legend=top-left)

## License

MIT

---

v1.7.57 | [Issues](https://github.com/fengshao1227/ccg-workflow/issues)
