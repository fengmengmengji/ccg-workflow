# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-01-05 ⭐

### 重大更新：MCP 动态选择系统

#### 核心特性

- **多 MCP 支持**：安装时可选择 ace-tool（第三方封装）或 auggie（官方原版）
- **交互式选择**：安装脚本提供友好的 MCP 选择界面，显示各选项的功能对比
- **配置文件驱动**：生成 `~/.ccg/config.toml` 记录 MCP 选择，命令模板动态适配
- **完全兼容**：命令模板根据配置自动使用正确的 MCP 工具名称
- **简洁高效**：命令模板引用共享配置，避免重复说明

#### 技术实现

- **install.py 更新**：
  - 新增 `choose_mcp_provider()` 函数：交互式选择界面
  - 新增 `install_auggie()` 函数：安装 auggie MCP (`@augmentcode/auggie@prerelease`)
  - 新增 `create_ccg_config()` 函数：生成配置文件 `~/.ccg/config.toml`
  - 修改 `execute_operation()`：支持 `"install_mcp"` 操作类型，动态路由到不同的安装函数

- **配置文件结构** (`~/.ccg/config.toml`)：
  ```toml
  [mcp]
  provider = "ace-tool"  # ace-tool | auggie | none

  [mcp.ace-tool]
  tools = ["enhance_prompt", "search_context"]

  [mcp.auggie]
  tools = ["codebase-retrieval"]
  note = "auggie 不包含 Prompt 增强工具，需手动配置"

  [routing]
  mode = "smart"
  # ... 模型路由配置
  ```

- **命令模板更新**（11个命令文件）：
  - 所有命令模板统一引用 `memorys/MCP_USAGE.md` 获取 MCP 调用规范
  - 移除重复的 MCP 工具调用说明，减少 50% 的提示词长度
  - 命令模板只需引用配置文件 `~/.ccg/config.toml` 中的工具映射表
  - 支持文件：`dev.md`, `enhance.md`, `code.md`, `debug.md`, `bugfix.md`, `test.md`, `think.md`, `optimize.md`, `analyze.md`, `backend.md`, `frontend.md`, `review.md`

- **工具映射对照**：
  | 功能 | ace-tool | auggie |
  |------|----------|--------|
  | Prompt 增强 | `mcp__ace-tool__enhance_prompt` | ❌ 不支持 |
  | 代码检索 | `mcp__ace-tool__search_context` | `mcp__auggie-mcp__codebase-retrieval` |

#### 用户体验

- **安装流程**：
  1. 运行 `python3 install.py` 或 `npx ccg-workflow`
  2. 看到 MCP 选择菜单，对比功能后选择
  3. 自动安装并配置对应的 MCP 工具
  4. 生成配置文件，记录选择

- **使用体验**：
  - 命令模板自动读取配置，无需手动修改
  - ace-tool 用户：完整功能（Prompt 增强 + 代码检索）
  - auggie 用户：代码检索功能，提示查看配置教程链接
  - 配置教程：https://linux.do/t/topic/1280612

#### 文档更新

- `README.md`：更新"首次安装"部分，说明 MCP 选择步骤
- `CLAUDE.md`：新增"MCP 工具选择"章节，详细说明两种 MCP 的区别
- `memorys/MCP_USAGE.md`：创建共享的 MCP 调用规范文档，所有命令引用
- `MCP_SELECTION_GUIDE.md`：创建工具映射指南，供开发者参考

#### 优化亮点

- **简洁性**：命令模板从平均 150 行减少到 80 行
- **可维护性**：MCP 调用逻辑统一管理，修改一处即可
- **可扩展性**：未来添加新 MCP 只需更新配置文件和 `MCP_USAGE.md`

---

## [1.2.3] - 2026-01-05

### 新增

- **二进制安装验证**：安装后自动验证 `codeagent-wrapper` 可用性
  - 在 `installCodeagentWrapper()` 中新增验证步骤
  - 执行 `codeagent-wrapper --version` 验证二进制文件正常运行
  - 显示版本信息确认安装成功

### 优化

- **错误显示**：安装失败时显示详细错误信息
  - 捕获并显示具体的错误消息
  - 提供友好的错误提示和解决建议
- **文档清理**：删除 `dev.md` 中的过时提示

---

## [1.2.2] - 2026-01-05

### 优化

- 删除重复的根目录提示词文件（`prompts/`）
- 只保留 `templates/prompts/` 作为安装模板源
- 从 `package.json` 的 `files` 字段移除 `"prompts"`
- npm 包减少 18 个文件（75 → 57 files）

---

## [1.2.1] - 2026-01-05

### 修复

- 确保 `~/.ccg/config.toml` 配置文件在安装失败时也能创建
- 将 `writeCcgConfig()` 调整到 `installWorkflows()` 之前执行
- 修复首次 `init` 时配置文件可能不存在的问题

---

## [1.2.0] - 2026-01-05 ⭐

### 重大更新：ROLE_FILE 动态注入

#### 核心特性

- **真正的动态注入**：`codeagent-wrapper` 自动识别 `ROLE_FILE:` 指令
- **0 token 消耗**：Claude 无需先用 Read 工具读取提示词文件
- **自动化管理**：一行 `ROLE_FILE:` 搞定，无需手动粘贴

#### 技术实现

在 `codeagent-wrapper/utils.go` 中新增 `injectRoleFile()` 函数：
- 使用正则 `^ROLE_FILE:\s*(.+)` 匹配指令
- 自动展开 `~/` 为用户 HOME 目录
- 读取文件内容并原地替换 `ROLE_FILE:` 行
- 完整日志记录注入过程（文件路径、大小）

在 `codeagent-wrapper/main.go` 中集成动态注入：
- Explicit stdin 模式支持
- Piped task 模式支持
- Parallel 模式支持（所有任务）

#### 更新内容

- 重新编译所有平台二进制文件（darwin-amd64, darwin-arm64, linux-amd64, windows-amd64）
- 更新所有命令模板，使用 `ROLE_FILE:` 替代手动读取

#### 使用示例

```bash
# 旧方式（已弃用）
⏺ Read(~/.claude/prompts/ccg/codex/reviewer.md)
codeagent-wrapper --backend codex - <<'EOF'
# 手动粘贴提示词内容...
<TASK>...</TASK>
EOF

# 新方式（v1.2.0）
codeagent-wrapper --backend codex - <<'EOF'
ROLE_FILE: ~/.claude/prompts/ccg/codex/reviewer.md

<TASK>审查代码...</TASK>
EOF
```

---

## [1.1.3] - 2026-01-05

### 新增功能

- **PATH 自动配置**：安装后自动配置 `codeagent-wrapper` 可执行路径
  - **Mac/Linux**：交互式提示，自动添加到 `.zshrc` 或 `.bashrc`
  - **Windows**：提供详细手动配置指南 + PowerShell 一键命令
  - 智能检测重复配置，避免多次添加

### 用户体验

- 安装完成后询问是否自动配置 PATH（Mac/Linux）
- 自动检测 shell 类型（zsh/bash）
- 检查是否已配置，避免重复添加
- Windows 用户获得分步操作指南

### 国际化

- 新增 11 个 i18n 翻译键（中文/英文）
- 优化提示信息的可读性

---

## [1.1.2] - 2026-01-05

### 新增功能

- **codeagent-wrapper 自动安装**：安装时自动复制二进制文件到 `~/.claude/bin/`
  - 跨平台支持：darwin-amd64, darwin-arm64, linux-amd64, windows-amd64
  - 自动设置可执行权限（Unix 系统）
  - 显示安装路径和配置说明

### 技术实现

- 修改 `src/types/index.ts` 添加 `binPath` 和 `binInstalled` 字段
- 修改 `src/utils/installer.ts` 实现平台检测和二进制安装逻辑
- 修改 `src/commands/init.ts` 显示 PATH 配置说明

### 用户体验

- 安装后显示 PATH 配置指令
- 提供友好的配置提示
- 新增 i18n 翻译

---

## [1.1.1] - 2026-01-05

### 文档更新

- 更新 README 添加智能更新功能详细说明
- 新增"更新到最新版本"独立章节
- 优化交互式菜单说明，分离首次安装和更新流程
- 在"最新更新"部分新增 v1.1.0 智能更新系统介绍

---

## [1.1.0] - 2026-01-05

### 新增功能

- **智能更新系统**：一键更新命令模板和提示词，无需卸载重装
  - 自动检测 npm 最新版本并对比当前版本
  - 增量更新，仅更新命令和提示词文件
  - 保留用户配置（`~/.ccg/config.toml`）
  - 支持强制重装，修复损坏的文件
  - 无需 sudo 权限

### 核心实现

- 新增 `src/utils/version.ts` - 版本管理工具
  - `getCurrentVersion()` - 获取当前安装版本
  - `getLatestVersion()` - 查询 npm 最新版本
  - `compareVersions()` - 语义化版本对比
  - `checkForUpdates()` - 检查是否有可用更新

- 新增 `src/commands/update.ts` - 更新命令实现
  - 交互式更新流程
  - 版本检测和对比
  - 强制重装选项

- 更新 `src/commands/menu.ts` - 菜单集成
  - 新增"更新工作流"选项
  - 移除复杂的备份管理功能

### 用户体验

- 运行 `npx ccg-workflow` 选择"更新工作流"即可更新
- 显示当前版本 vs 最新版本对比
- 自动更新所有文件并保留配置
- 提供友好的进度提示和错误处理

---

## [1.0.6] - 2026-01-05

### 修复

- 修复命令模板中的 MCP 工具参数缺失问题
- 在所有命令模板中添加 `mcp__ace-tool__search_context` 完整参数说明
- 在 enhance/dev 模板中添加 `mcp__ace-tool__enhance_prompt` 参数说明
- 更新 `_config.md` 中的提示词路径引用

---

## [1.0.5] - 2026-01-05

### 修复

- 修复安装时复制 CLAUDE.md 到用户目录的问题
- 斜杠命令已自包含完整工作流指令
- 避免覆盖用户已有的 `~/.claude/CLAUDE.md` 配置

---

## [1.0.4] - 2026-01-05

### 新增

- 补充 init-project 命令所需的两个 subagent
  - `init-architect.md` - 架构师子智能体
  - `planner.md` - 任务规划师

---

## [1.0.3] - 2026-01-05

### 新增

- 为所有多模型命令添加 codeagent-wrapper 调用示例
- 优化命令模板，明确使用方式

---

## [1.0.2] - 2026-01-05

### 优化

- 优化 token 消耗，改用子进程读取角色提示词文件
- 减少内存占用

---

## [1.0.1] - 2026-01-05

### 修复

- 修复命令模板调用方式
- 明确使用 codeagent-wrapper 的标准语法

---

## [1.0.0] - 2026-01-05

### 重大更新：npm 首次发布

#### 安装方式革命性升级

- ✅ 从 Python 脚本重构为 **TypeScript + unbuild** 构建系统
- ✅ 发布到 npm: `npx ccg-workflow` 一键安装
- ✅ 交互式配置菜单（初始化/卸载）
- ✅ 更好的跨平台兼容性

#### 三模型协作时代

- ✅ 从双模型 (Codex + Gemini) 扩展到 **三模型 (Claude + Codex + Gemini)**
- ✅ 新增 6 个 Claude 角色提示词（architect, analyzer, debugger, optimizer, reviewer, tester）
- ✅ 专家提示词从 12 个扩展到 **18 个**

#### 配置系统升级

- ✅ 配置文件从 `config.json` 迁移到 `~/.ccg/config.toml`
- ✅ 支持 **smart/parallel/sequential** 三种协作模式
- ✅ 可配置前端/后端模型优先级

#### 核心功能

**开发工作流（12个命令）**
- `/ccg:dev` - 完整6阶段三模型工作流
- `/ccg:code` - 三模型代码生成（智能路由）
- `/ccg:debug` - UltraThink 三模型调试
- `/ccg:test` - 三模型测试生成
- `/ccg:bugfix` - 质量门控修复（90%+ 通过）
- `/ccg:think` - 深度分析
- `/ccg:optimize` - 性能优化
- `/ccg:frontend` - 前端任务 → Gemini
- `/ccg:backend` - 后端任务 → Codex
- `/ccg:review` - 三模型代码审查
- `/ccg:analyze` - 三模型技术分析
- `/ccg:enhance` - Prompt 增强（ace-tool MCP）

**智能规划（2个命令）**
- `/ccg:scan` - 智能仓库扫描
- `/ccg:feat` - 智能功能开发

**Git 工具（4个命令）**
- `/ccg:commit` - 智能 commit（支持 emoji）
- `/ccg:rollback` - 交互式回滚
- `/ccg:clean-branches` - 清理已合并分支
- `/ccg:worktree` - Worktree 管理

**项目初始化（1个命令）**
- `/ccg:init` - 初始化项目 AI 上下文

#### 专家提示词系统

**18个角色文件**，动态角色注入：
- **Codex 角色**（6个）：architect, analyzer, debugger, tester, reviewer, optimizer
- **Gemini 角色**（6个）：frontend, analyzer, debugger, tester, reviewer, optimizer
- **Claude 角色**（6个）：architect, analyzer, debugger, tester, reviewer, optimizer

#### 技术栈

- **构建工具**: unbuild
- **编程语言**: TypeScript
- **CLI 框架**: cac
- **交互界面**: inquirer
- **配置格式**: TOML
- **国际化**: i18next

#### 依赖项

```json
{
  "ansis": "^4.1.0",
  "cac": "^6.7.14",
  "fs-extra": "^11.3.2",
  "i18next": "^25.5.2",
  "inquirer": "^12.9.6",
  "ora": "^9.0.0",
  "pathe": "^2.0.3",
  "smol-toml": "^1.4.2"
}
```

---

## [Pre-1.0.0] - Python 版本

### Python 安装脚本时代（已弃用）

使用 `python3 install.py` 进行安装，支持双模型协作（Codex + Gemini）。

**主要限制**：
- 需要手动 clone 仓库
- Python 环境依赖
- 配置不够灵活
- 更新需要重新安装

---

## 链接

- [GitHub Repository](https://github.com/fengshao1227/ccg-workflow)
- [npm Package](https://www.npmjs.com/package/ccg-workflow)
- [README](https://github.com/fengshao1227/ccg-workflow/blob/main/README.md)
