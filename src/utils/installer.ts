import type { AceToolConfig, FastContextConfig, InstallResult, WorkflowConfig } from '../types'
import { homedir } from 'node:os'
import fs from 'fs-extra'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'pathe'
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
import { backupClaudeCodeConfig, buildMcpServerConfig, fixWindowsMcpConfig, mergeMcpServers, readClaudeCodeConfig, writeClaudeCodeConfig } from './mcp'
import { isWindows } from './platform'

// GitHub Release download config
const GITHUB_REPO = 'fengshao1227/ccg-workflow'
const RELEASE_TAG = 'preset'
const BINARY_DOWNLOAD_URL = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}`

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Find package root by looking for package.json
function findPackageRoot(startDir: string): string {
  let dir = startDir
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(join(dir, 'package.json'))) {
      return dir
    }
    dir = dirname(dir)
  }
  return startDir
}

const PACKAGE_ROOT = findPackageRoot(__dirname)

/**
 * Download codeagent-wrapper binary from GitHub Release.
 * Uses the fixed `preset` tag release for pre-compiled binaries.
 * Supports redirect-following (GitHub releases redirect to CDN).
 *
 * Retry: 3 attempts with exponential backoff (2s, 4s, 6s).
 * Timeout: 60s per attempt via AbortController.
 */
async function downloadBinaryFromRelease(binaryName: string, destPath: string): Promise<boolean> {
  const url = `${BINARY_DOWNLOAD_URL}/${binaryName}`
  const MAX_ATTEMPTS = 3
  const TIMEOUT_MS = 60_000 // 60s per attempt

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const response = await fetch(url, { redirect: 'follow', signal: controller.signal })
      if (!response.ok) {
        clearTimeout(timer)
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000))
          continue
        }
        return false
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      clearTimeout(timer)

      await fs.writeFile(destPath, buffer)

      // Set executable permission on Unix-like systems
      if (process.platform !== 'win32') {
        await fs.chmod(destPath, 0o755)
      }

      return true
    }
    catch {
      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
        continue
      }
      return false
    }
  }

  return false
}

// All available commands (20 total after adding spec commands)
const ALL_COMMANDS = [
  'workflow', // 完整6阶段开发工作流
  'plan', // 多模型协作规划（Phase 1-2）
  'execute', // 多模型协作执行（Phase 3-5）
  'frontend', // 前端专项（Gemini主导）
  'backend', // 后端专项（Codex主导）
  'feat', // 智能功能开发
  'analyze', // 技术分析
  'debug', // 问题诊断+修复
  'optimize', // 性能优化
  'test', // 测试生成
  'review', // 代码审查
  'init', // 初始化 CLAUDE.md
  'commit', // Git 智能提交
  'rollback', // Git 回滚
  'clean-branches', // Git 清理分支
  'worktree', // Git Worktree
  'spec-init', // OpenSpec 初始化
  'spec-research', // 需求研究 → 约束集
  'spec-plan', // 多模型分析 → 零决策计划
  'spec-impl', // 多模型协作实现
  'spec-review', // 归档前多模型审查
  'team-research', // Agent Teams 需求研究（并行探索 → 约束集）
  'team-plan', // Agent Teams 规划（Lead 调 Codex/Gemini 产出并行计划）
  'team-exec', // Agent Teams 并行实施（spawn Builders 并行写代码）
  'team-review', // Agent Teams 审查（双模型交叉审查并行产出）
  'codex-exec', // 读取计划文件，Codex 全权执行 + 多模型审核
  'context', // 项目上下文管理（.context 目录初始化/日志/压缩/历史）
] as const

// Workflow configurations (for compatibility with existing code)
const WORKFLOW_CONFIGS: WorkflowConfig[] = [
  {
    id: 'workflow',
    name: '完整开发工作流',
    nameEn: 'Full Development Workflow',
    category: 'development',
    commands: ['workflow'],
    defaultSelected: true,
    order: 1,
    description: '完整6阶段开发工作流（研究→构思→计划→执行→优化→评审）',
    descriptionEn: 'Full 6-phase development workflow',
  },
  {
    id: 'plan',
    name: '多模型协作规划',
    nameEn: 'Multi-Model Planning',
    category: 'development',
    commands: ['plan'],
    defaultSelected: true,
    order: 1.5,
    description: '上下文检索 + 双模型分析 → 生成 Step-by-step 实施计划',
    descriptionEn: 'Context retrieval + dual-model analysis → Step-by-step plan',
  },
  {
    id: 'execute',
    name: '多模型协作执行',
    nameEn: 'Multi-Model Execution',
    category: 'development',
    commands: ['execute'],
    defaultSelected: true,
    order: 1.6,
    description: '根据计划获取原型 → Claude 重构实施 → 多模型审计交付',
    descriptionEn: 'Get prototype from plan → Claude refactor → Multi-model audit',
  },
  {
    id: 'frontend',
    name: '前端专项',
    nameEn: 'Frontend Tasks',
    category: 'development',
    commands: ['frontend'],
    defaultSelected: true,
    order: 2,
    description: '前端专项任务（Gemini主导，更快更精准）',
    descriptionEn: 'Frontend tasks (Gemini-led, faster)',
  },
  {
    id: 'backend',
    name: '后端专项',
    nameEn: 'Backend Tasks',
    category: 'development',
    commands: ['backend'],
    defaultSelected: true,
    order: 3,
    description: '后端专项任务（Codex主导，更快更精准）',
    descriptionEn: 'Backend tasks (Codex-led, faster)',
  },
  {
    id: 'feat',
    name: '智能功能开发',
    nameEn: 'Smart Feature Development',
    category: 'development',
    commands: ['feat'],
    defaultSelected: true,
    order: 4,
    description: '智能功能开发 - 自动规划、设计、实施',
    descriptionEn: 'Smart feature development - auto plan, design, implement',
  },
  {
    id: 'analyze',
    name: '技术分析',
    nameEn: 'Technical Analysis',
    category: 'development',
    commands: ['analyze'],
    defaultSelected: true,
    order: 5,
    description: '双模型技术分析，仅分析不修改代码',
    descriptionEn: 'Dual-model technical analysis, analysis only',
  },
  {
    id: 'debug',
    name: '问题诊断',
    nameEn: 'Debug',
    category: 'development',
    commands: ['debug'],
    defaultSelected: true,
    order: 6,
    description: '多模型诊断 + 修复',
    descriptionEn: 'Multi-model diagnosis + fix',
  },
  {
    id: 'optimize',
    name: '性能优化',
    nameEn: 'Performance Optimization',
    category: 'development',
    commands: ['optimize'],
    defaultSelected: true,
    order: 7,
    description: '多模型性能优化',
    descriptionEn: 'Multi-model performance optimization',
  },
  {
    id: 'test',
    name: '测试生成',
    nameEn: 'Test Generation',
    category: 'development',
    commands: ['test'],
    defaultSelected: true,
    order: 8,
    description: '智能路由测试生成',
    descriptionEn: 'Smart routing test generation',
  },
  {
    id: 'review',
    name: '代码审查',
    nameEn: 'Code Review',
    category: 'development',
    commands: ['review'],
    defaultSelected: true,
    order: 9,
    description: '双模型代码审查，无参数时自动审查 git diff',
    descriptionEn: 'Dual-model code review, auto-review git diff when no args',
  },
  {
    id: 'enhance',
    name: 'Prompt 增强',
    nameEn: 'Prompt Enhancement',
    category: 'development',
    commands: ['enhance'],
    defaultSelected: true,
    order: 9.5,
    description: 'ace-tool Prompt 增强工具',
    descriptionEn: 'ace-tool prompt enhancement',
  },
  {
    id: 'init-project',
    name: '项目初始化',
    nameEn: 'Project Init',
    category: 'init',
    commands: ['init'],
    defaultSelected: true,
    order: 10,
    description: '初始化项目 AI 上下文，生成 CLAUDE.md',
    descriptionEn: 'Initialize project AI context, generate CLAUDE.md',
  },
  {
    id: 'commit',
    name: 'Git 提交',
    nameEn: 'Git Commit',
    category: 'git',
    commands: ['commit'],
    defaultSelected: true,
    order: 20,
    description: '智能生成 conventional commit 信息',
    descriptionEn: 'Smart conventional commit message generation',
  },
  {
    id: 'rollback',
    name: 'Git 回滚',
    nameEn: 'Git Rollback',
    category: 'git',
    commands: ['rollback'],
    defaultSelected: true,
    order: 21,
    description: '交互式回滚分支到历史版本',
    descriptionEn: 'Interactive rollback to historical version',
  },
  {
    id: 'clean-branches',
    name: 'Git 清理分支',
    nameEn: 'Git Clean Branches',
    category: 'git',
    commands: ['clean-branches'],
    defaultSelected: true,
    order: 22,
    description: '安全清理已合并或过期分支',
    descriptionEn: 'Safely clean merged or stale branches',
  },
  {
    id: 'worktree',
    name: 'Git Worktree',
    nameEn: 'Git Worktree',
    category: 'git',
    commands: ['worktree'],
    defaultSelected: true,
    order: 23,
    description: '管理 Git worktree',
    descriptionEn: 'Manage Git worktree',
  },
  {
    id: 'spec-init',
    name: 'OpenSpec 初始化',
    nameEn: 'OpenSpec Init',
    category: 'spec',
    commands: ['spec-init'],
    defaultSelected: true,
    order: 30,
    description: '初始化 OpenSpec 环境 + 验证多模型 MCP 工具',
    descriptionEn: 'Initialize OpenSpec environment with multi-model MCP validation',
  },
  {
    id: 'spec-research',
    name: '需求研究',
    nameEn: 'Spec Research',
    category: 'spec',
    commands: ['spec-research'],
    defaultSelected: true,
    order: 31,
    description: '需求 → 约束集（并行探索 + OpenSpec 提案）',
    descriptionEn: 'Transform requirements into constraint sets via parallel exploration',
  },
  {
    id: 'spec-plan',
    name: '零决策规划',
    nameEn: 'Spec Plan',
    category: 'spec',
    commands: ['spec-plan'],
    defaultSelected: true,
    order: 32,
    description: '多模型分析 → 消除歧义 → 零决策可执行计划',
    descriptionEn: 'Refine proposals into zero-decision executable plans',
  },
  {
    id: 'spec-impl',
    name: '规范驱动实现',
    nameEn: 'Spec Implementation',
    category: 'spec',
    commands: ['spec-impl'],
    defaultSelected: true,
    order: 33,
    description: '按规范执行 + 多模型协作 + 归档',
    descriptionEn: 'Execute changes via multi-model collaboration with spec compliance',
  },
  {
    id: 'spec-review',
    name: '归档前审查',
    nameEn: 'Spec Review',
    category: 'spec',
    commands: ['spec-review'],
    defaultSelected: true,
    order: 34,
    description: '双模型交叉审查 → Critical 必须修复 → 允许归档',
    descriptionEn: 'Multi-model compliance review before archiving',
  },
  {
    id: 'team-research',
    name: 'Agent Teams 需求研究',
    nameEn: 'Agent Teams Research',
    category: 'development',
    commands: ['team-research'],
    defaultSelected: true,
    order: 1.8,
    description: '并行探索代码库，产出约束集 + 可验证成功判据',
    descriptionEn: 'Parallel codebase exploration, produces constraint sets + success criteria',
  },
  {
    id: 'team-plan',
    name: 'Agent Teams 规划',
    nameEn: 'Agent Teams Planning',
    category: 'development',
    commands: ['team-plan'],
    defaultSelected: true,
    order: 2,
    description: 'Lead 调用 Codex/Gemini 并行分析，产出零决策并行实施计划',
    descriptionEn: 'Lead orchestrates Codex/Gemini analysis, produces zero-decision parallel plan',
  },
  {
    id: 'team-exec',
    name: 'Agent Teams 并行实施',
    nameEn: 'Agent Teams Parallel Execution',
    category: 'development',
    commands: ['team-exec'],
    defaultSelected: true,
    order: 2.5,
    description: '读取计划文件，spawn Builder teammates 并行写代码，需启用 Agent Teams',
    descriptionEn: 'Read plan file, spawn Builder teammates for parallel implementation',
  },
  {
    id: 'team-review',
    name: 'Agent Teams 审查',
    nameEn: 'Agent Teams Review',
    category: 'development',
    commands: ['team-review'],
    defaultSelected: true,
    order: 3,
    description: '双模型交叉审查并行实施产出，分级处理 Critical/Warning/Info',
    descriptionEn: 'Dual-model cross-review with severity classification',
  },
  {
    id: 'codex-exec',
    name: 'Codex 执行计划',
    nameEn: 'Codex Plan Executor',
    category: 'development',
    commands: ['codex-exec'],
    defaultSelected: true,
    order: 3,
    description: '读取 /ccg:plan 计划文件，Codex 全权执行 + 多模型审核',
    descriptionEn: 'Read plan file from /ccg:plan, Codex executes + multi-model review',
  },
  {
    id: 'context',
    name: '项目上下文管理',
    nameEn: 'Project Context Manager',
    category: 'development',
    commands: ['context'],
    defaultSelected: true,
    order: 4,
    description: '初始化 .context 目录、记录决策日志、压缩归档、查看历史',
    descriptionEn: 'Init .context dir, log decisions, compress, view history',
  },
]

export function getWorkflowConfigs(): WorkflowConfig[] {
  return WORKFLOW_CONFIGS.sort((a, b) => a.order - b.order)
}

export function getWorkflowById(id: string): WorkflowConfig | undefined {
  return WORKFLOW_CONFIGS.find(w => w.id === id)
}

/**
 * Get all command IDs for installation
 * No more presets - always install all commands
 */
export function getAllCommandIds(): string[] {
  return WORKFLOW_CONFIGS.map(w => w.id)
}

/**
 * @deprecated Use getAllCommandIds() instead
 * Kept for backward compatibility
 */
export const WORKFLOW_PRESETS = {
  full: {
    name: '完整',
    nameEn: 'Full',
    description: '全部命令（21个）',
    descriptionEn: 'All commands (21)',
    workflows: WORKFLOW_CONFIGS.map(w => w.id),
  },
}

export type WorkflowPreset = keyof typeof WORKFLOW_PRESETS

export function getWorkflowPreset(preset: WorkflowPreset): string[] {
  return [...WORKFLOW_PRESETS[preset].workflows]
}

/**
 * Replace template variables in content based on user configuration
 * This injects model routing configs at install time
 * Note: MCP tool names are now hardcoded to ace-tool in templates
 */
export function injectConfigVariables(content: string, config: {
  routing?: {
    mode?: string
    frontend?: { models?: string[], primary?: string }
    backend?: { models?: string[], primary?: string }
    review?: { models?: string[] }
  }
  liteMode?: boolean
  mcpProvider?: string
}): string {
  let processed = content

  // Model routing injection
  const routing = config.routing || {}

  // Frontend models
  const frontendModels = routing.frontend?.models || ['gemini']
  const frontendPrimary = routing.frontend?.primary || 'gemini'
  processed = processed.replace(/\{\{FRONTEND_MODELS\}\}/g, JSON.stringify(frontendModels))
  processed = processed.replace(/\{\{FRONTEND_PRIMARY\}\}/g, frontendPrimary)

  // Backend models
  const backendModels = routing.backend?.models || ['codex']
  const backendPrimary = routing.backend?.primary || 'codex'
  processed = processed.replace(/\{\{BACKEND_MODELS\}\}/g, JSON.stringify(backendModels))
  processed = processed.replace(/\{\{BACKEND_PRIMARY\}\}/g, backendPrimary)

  // Review models
  const reviewModels = routing.review?.models || ['codex', 'gemini']
  processed = processed.replace(/\{\{REVIEW_MODELS\}\}/g, JSON.stringify(reviewModels))

  // Routing mode
  const routingMode = routing.mode || 'smart'
  processed = processed.replace(/\{\{ROUTING_MODE\}\}/g, routingMode)

  // Lite mode flag for codeagent-wrapper
  // If liteMode is true, inject "--lite" flag
  const liteModeFlag = config.liteMode ? '--lite ' : ''
  processed = processed.replace(/\{\{LITE_MODE_FLAG\}\}/g, liteModeFlag)

  // MCP tool injection based on provider
  const mcpProvider = config.mcpProvider || 'ace-tool'
  if (mcpProvider === 'skip') {
    // MCP skipped: remove all MCP tool references, replace with Glob+Grep fallback

    // 1) Agent frontmatter — remove MCP tool from tools declaration
    processed = processed.replace(/,\s*\{\{MCP_SEARCH_TOOL\}\}/g, '')

    // 2) Code blocks containing MCP tool invocation — replace with fallback guidance
    processed = processed.replace(
      /```\n\{\{MCP_SEARCH_TOOL\}\}[\s\S]*?\n```/g,
      '> MCP 未配置。使用 `Glob` 定位文件 + `Grep` 搜索关键符号 + `Read` 读取文件内容。',
    )

    // 3) Inline backtick references — replace with fallback tool names
    processed = processed.replace(
      /`\{\{MCP_SEARCH_TOOL\}\}`/g,
      '`Glob + Grep`（MCP 未配置）',
    )

    // 4) Any remaining bare references (safety net)
    processed = processed.replace(/\{\{MCP_SEARCH_TOOL\}\}/g, 'Glob + Grep')

    // 5) MCP_SEARCH_PARAM — not applicable when skipped
    processed = processed.replace(/\{\{MCP_SEARCH_PARAM\}\}/g, '')
  }
  else if (mcpProvider === 'contextweaver') {
    // ContextWeaver MCP tools
    processed = processed.replace(/\{\{MCP_SEARCH_TOOL\}\}/g, 'mcp__contextweaver__codebase-retrieval')
    processed = processed.replace(/\{\{MCP_SEARCH_PARAM\}\}/g, 'information_request')
  }
  else if (mcpProvider === 'fast-context') {
    // Fast Context (Windsurf) MCP tools
    processed = processed.replace(/\{\{MCP_SEARCH_TOOL\}\}/g, 'mcp__fast-context__fast_context_search')
    processed = processed.replace(/\{\{MCP_SEARCH_PARAM\}\}/g, 'query')
  }
  else {
    // ace-tool / ace-tool-rs MCP tools (default)
    processed = processed.replace(/\{\{MCP_SEARCH_TOOL\}\}/g, 'mcp__ace-tool__search_context')
    processed = processed.replace(/\{\{MCP_SEARCH_PARAM\}\}/g, 'query')
  }

  return processed
}

/**
 * Normalize path for the current platform
 * - Windows: C:\Users\zlb (Native Windows path, for PowerShell/CMD compatibility)
 * - Unix: /Users/zlb
 */
function normalizePath(p: string): string {
  if (isWindows()) {
    // Return native Windows path (backslashes)
    // This is critical for PowerShell execution which fails with /c/Users/... style paths
    return p.replace(/\//g, '\\')
  }
  return p
}

/**
 * Convert Windows path to Git Bash compatible format
 * C:\Users\zlb → /c/Users/zlb
 * D:\code → /d/code
 */
function convertToGitBashPath(windowsPath: string): string {
  if (!isWindows()) {
    return windowsPath
  }

  // Normalize to forward slashes first
  let path = windowsPath.replace(/\\/g, '/')

  // Convert drive letter: C:/Users/... → /c/Users/...
  // Match pattern: [A-Z]:/ at the start
  path = path.replace(/^([A-Z]):/i, (_, drive) => `/${drive.toLowerCase()}`)

  return path
}

/**
 * Replace ~ paths in template content with absolute paths
 * This fixes Windows multi-user path resolution issues
 *
 * IMPORTANT: Always use forward slashes (/) for cross-platform compatibility.
 * Windows Git Bash requires forward slashes in heredoc (backslashes get escaped).
 * PowerShell and CMD also support forward slashes for most commands.
 */
function replaceHomePathsInTemplate(content: string, installDir: string): string {
  // Get absolute paths for replacement
  const userHome = homedir()
  const ccgDir = join(installDir, '.ccg')
  const binDir = join(installDir, 'bin')
  const claudeDir = installDir // ~/.claude

  // IMPORTANT: Always use forward slashes for cross-platform compatibility
  // Git Bash on Windows requires forward slashes in heredoc (backslashes get escaped)
  // PowerShell and CMD also support forward slashes for most commands
  const normalizePath = (path: string) => path.replace(/\\/g, '/')

  let processed = content

  // Order matters: replace longer patterns first to avoid partial matches
  // 1. Replace ~/.claude/.ccg with absolute path (longest match first)
  processed = processed.replace(/~\/\.claude\/\.ccg/g, normalizePath(ccgDir))

  // 2. Replace ~/.claude/bin/codeagent-wrapper with absolute path + .exe on Windows
  //    CRITICAL: Windows Git Bash requires explicit .exe extension
  const wrapperName = isWindows() ? 'codeagent-wrapper.exe' : 'codeagent-wrapper'
  const wrapperPath = `${normalizePath(binDir)}/${wrapperName}`
  processed = processed.replace(/~\/\.claude\/bin\/codeagent-wrapper/g, wrapperPath)

  // 3. Replace ~/.claude/bin with absolute path (for other binaries)
  processed = processed.replace(/~\/\.claude\/bin/g, normalizePath(binDir))

  // 4. Replace ~/.claude with absolute path
  processed = processed.replace(/~\/\.claude/g, normalizePath(claudeDir))

  // 5. Replace remaining ~/ patterns with user home
  processed = processed.replace(/~\//g, `${normalizePath(userHome)}/`)

  return processed
}

/**
 * Count installed SKILL.md files in the skills directory (recursive).
 * Excludes root-level SKILL.md (which is the index/manifest, not a skill itself).
 */
async function countInstalledSkills(skillsDir: string, depth = 0): Promise<number> {
  let count = 0
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(skillsDir, entry.name)
      if (entry.isDirectory()) {
        count += await countInstalledSkills(fullPath, depth + 1)
      }
      else if (entry.name === 'SKILL.md' && depth > 0) {
        count++
      }
    }
  }
  catch {
    // Directory doesn't exist or can't be read
  }
  return count
}

export async function installWorkflows(
  workflowIds: string[],
  installDir: string,
  force = false,
  config?: {
    routing?: {
      mode?: string
      frontend?: { models?: string[], primary?: string }
      backend?: { models?: string[], primary?: string }
      review?: { models?: string[] }
    }
    liteMode?: boolean
    mcpProvider?: string
  },
): Promise<InstallResult> {
  // Default config
  const installConfig = {
    routing: config?.routing || {
      mode: 'smart',
      frontend: { models: ['gemini'], primary: 'gemini' },
      backend: { models: ['codex'], primary: 'codex' },
      review: { models: ['codex', 'gemini'] },
    },
    liteMode: config?.liteMode || false,
    mcpProvider: config?.mcpProvider || 'ace-tool',
  }
  const result: InstallResult = {
    success: true,
    installedCommands: [],
    installedPrompts: [],
    errors: [],
    configPath: '',
  }

  const commandsDir = join(installDir, 'commands', 'ccg')
  const ccgConfigDir = join(installDir, '.ccg') // v1.4.0: 配置目录
  const promptsDir = join(ccgConfigDir, 'prompts') // v1.4.0: prompts 移到配置目录

  await fs.ensureDir(commandsDir)
  await fs.ensureDir(ccgConfigDir)
  await fs.ensureDir(promptsDir)

  // Get template source directory (relative to this package)
  const templateDir = join(PACKAGE_ROOT, 'templates')

  // Install commands
  for (const workflowId of workflowIds) {
    const workflow = getWorkflowById(workflowId)
    if (!workflow) {
      result.errors.push(`Unknown workflow: ${workflowId}`)
      continue
    }

    for (const cmd of workflow.commands) {
      const srcFile = join(templateDir, 'commands', `${cmd}.md`)
      const destFile = join(commandsDir, `${cmd}.md`)

      try {
        if (await fs.pathExists(srcFile)) {
          if (force || !(await fs.pathExists(destFile))) {
            // Read template content, inject config variables, replace ~ paths, then write
            let templateContent = await fs.readFile(srcFile, 'utf-8')
            templateContent = injectConfigVariables(templateContent, installConfig)
            const processedContent = replaceHomePathsInTemplate(templateContent, installDir)
            await fs.writeFile(destFile, processedContent, 'utf-8')
            result.installedCommands.push(cmd)
          }
        }
        else {
          // If template doesn't exist, create placeholder
          const placeholder = `---
description: "${workflow.descriptionEn}"
---

# /ccg:${cmd}

${workflow.description}

> This command is part of CCG multi-model collaboration system.
`
          await fs.writeFile(destFile, placeholder, 'utf-8')
          result.installedCommands.push(cmd)
        }
      }
      catch (error) {
        result.errors.push(`Failed to install ${cmd}: ${error}`)
        result.success = false
      }
    }
  }

  // Install agents directory (subagents - should go to ~/.claude/agents/ccg/)
  const agentsSrcDir = join(templateDir, 'commands', 'agents')
  const agentsDestDir = join(installDir, 'agents', 'ccg')
  if (await fs.pathExists(agentsSrcDir)) {
    try {
      await fs.ensureDir(agentsDestDir)
      const agentFiles = await fs.readdir(agentsSrcDir)
      for (const file of agentFiles) {
        if (file.endsWith('.md')) {
          const srcFile = join(agentsSrcDir, file)
          const destFile = join(agentsDestDir, file)
          if (force || !(await fs.pathExists(destFile))) {
            // Read template content, inject config variables, replace ~ paths, then write
            let templateContent = await fs.readFile(srcFile, 'utf-8')
            templateContent = injectConfigVariables(templateContent, installConfig)
            const processedContent = replaceHomePathsInTemplate(templateContent, installDir)
            await fs.writeFile(destFile, processedContent, 'utf-8')
          }
        }
      }
    }
    catch (error) {
      result.errors.push(`Failed to install agents: ${error}`)
      result.success = false
    }
  }

  // Install prompts (codex, gemini, claude role definitions)
  const promptsTemplateDir = join(templateDir, 'prompts')
  if (await fs.pathExists(promptsTemplateDir)) {
    const modelDirs = ['codex', 'gemini', 'claude']
    for (const model of modelDirs) {
      const srcModelDir = join(promptsTemplateDir, model)
      const destModelDir = join(promptsDir, model)

      if (await fs.pathExists(srcModelDir)) {
        try {
          await fs.ensureDir(destModelDir)
          const files = await fs.readdir(srcModelDir)
          for (const file of files) {
            if (file.endsWith('.md')) {
              const srcFile = join(srcModelDir, file)
              const destFile = join(destModelDir, file)
              if (force || !(await fs.pathExists(destFile))) {
                // Read template content, replace ~ paths, then write
                const templateContent = await fs.readFile(srcFile, 'utf-8')
                const processedContent = replaceHomePathsInTemplate(templateContent, installDir)
                await fs.writeFile(destFile, processedContent, 'utf-8')
                result.installedPrompts.push(`${model}/${file.replace('.md', '')}`)
              }
            }
          }
        }
        catch (error) {
          result.errors.push(`Failed to install ${model} prompts: ${error}`)
          result.success = false
        }
      }
    }
  }

  // Install skills (quality gates, multi-agent orchestration, etc. → ~/.claude/skills/ccg/)
  // Uses 'ccg' namespace to avoid clobbering user's own skills on uninstall
  const skillsTemplateDir = join(templateDir, 'skills')
  const skillsDestDir = join(installDir, 'skills', 'ccg')
  if (await fs.pathExists(skillsTemplateDir)) {
    try {
      // Migration: move old v1.7.73 layout (skills/{tools,orchestration,SKILL.md,run_skill.js})
      // into skills/ccg/ namespace, preserving user's own skills in skills/
      const oldSkillsRoot = join(installDir, 'skills')
      const ccgLegacyItems = ['tools', 'orchestration', 'SKILL.md', 'run_skill.js']
      const needsMigration = !await fs.pathExists(skillsDestDir)
        && await fs.pathExists(join(oldSkillsRoot, 'tools'))
      if (needsMigration) {
        await fs.ensureDir(skillsDestDir)
        for (const item of ccgLegacyItems) {
          const oldPath = join(oldSkillsRoot, item)
          const newPath = join(skillsDestDir, item)
          if (await fs.pathExists(oldPath)) {
            await fs.move(oldPath, newPath, { overwrite: true })
          }
        }
      }

      // Recursive copy: preserves full directory tree (tools/lib, tools/*/scripts/, orchestration/*)
      await fs.copy(skillsTemplateDir, skillsDestDir, {
        overwrite: force,
        errorOnExist: false,
      })

      // Post-copy: apply template variable replacement to .md files
      // (handles custom installDir where ~/.claude paths need substitution)
      const replacePathsInDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            await replacePathsInDir(fullPath)
          }
          else if (entry.name.endsWith('.md')) {
            const content = await fs.readFile(fullPath, 'utf-8')
            const processed = replaceHomePathsInTemplate(content, installDir)
            if (processed !== content) {
              await fs.writeFile(fullPath, processed, 'utf-8')
            }
          }
        }
      }
      await replacePathsInDir(skillsDestDir)

      result.installedSkills = await countInstalledSkills(skillsDestDir)
    }
    catch (error) {
      result.errors.push(`Failed to install skills: ${error}`)
      result.success = false
    }
  }

  // Install rules (quality gate auto-trigger → ~/.claude/rules/ccg-skills.md)
  const rulesTemplateDir = join(templateDir, 'rules')
  const rulesDestDir = join(installDir, 'rules')
  if (await fs.pathExists(rulesTemplateDir)) {
    try {
      await fs.ensureDir(rulesDestDir)
      const rulesFiles = await fs.readdir(rulesTemplateDir)
      for (const file of rulesFiles) {
        if (file.endsWith('.md')) {
          const srcFile = join(rulesTemplateDir, file)
          const destFile = join(rulesDestDir, file)
          if (force || !(await fs.pathExists(destFile))) {
            const templateContent = await fs.readFile(srcFile, 'utf-8')
            const processedContent = replaceHomePathsInTemplate(templateContent, installDir)
            await fs.writeFile(destFile, processedContent, 'utf-8')
          }
        }
      }
      result.installedRules = true
    }
    catch (error) {
      result.errors.push(`Failed to install rules: ${error}`)
    }
  }

  // Install codeagent-wrapper binary
  try {
    const binDir = join(installDir, 'bin')
    await fs.ensureDir(binDir)

    // Detect platform and select appropriate binary
    const platform = process.platform
    const arch = process.arch
    let binaryName: string

    if (platform === 'darwin') {
      binaryName = arch === 'arm64' ? 'codeagent-wrapper-darwin-arm64' : 'codeagent-wrapper-darwin-amd64'
    }
    else if (platform === 'linux') {
      binaryName = arch === 'arm64' ? 'codeagent-wrapper-linux-arm64' : 'codeagent-wrapper-linux-amd64'
    }
    else if (platform === 'win32') {
      binaryName = arch === 'arm64' ? 'codeagent-wrapper-windows-arm64.exe' : 'codeagent-wrapper-windows-amd64.exe'
    }
    else {
      result.errors.push(`Unsupported platform: ${platform}`)
      result.success = false
      result.configPath = commandsDir
      return result
    }

    const destBinary = join(binDir, platform === 'win32' ? 'codeagent-wrapper.exe' : 'codeagent-wrapper')

    // Download from GitHub Release (3 attempts with retry)
    const installed = await downloadBinaryFromRelease(binaryName, destBinary)

    if (installed) {
      // Verify installation by running --version
      try {
        const { execSync } = await import('node:child_process')
        execSync(`"${destBinary}" --version`, { stdio: 'pipe' })
        result.binPath = binDir
        result.binInstalled = true
      }
      catch (verifyError) {
        // Binary downloaded but verification failed — warning, not blocking
        result.errors.push(`Binary verification failed (non-blocking): ${verifyError}`)
      }
    }
    else {
      // Binary download failed — warning, not blocking (commands + skills still work)
      result.errors.push(`Failed to download binary: ${binaryName} from GitHub Release (after 3 attempts). Check network or visit https://github.com/${GITHUB_REPO}/releases/tag/${RELEASE_TAG}`)
    }
  }
  catch (error) {
    // Binary install exception — warning, not blocking
    result.errors.push(`Failed to install codeagent-wrapper (non-blocking): ${error}`)
  }

  result.configPath = commandsDir
  return result
}

// Removed: getClaudeCodeConfigPath - now imported from './mcp'

/**
 * Install and configure ace-tool MCP for Claude Code
 * Writes to ~/.claude.json (the correct config file for Claude Code CLI)
 */
export interface UninstallResult {
  success: boolean
  removedCommands: string[]
  removedPrompts: string[]
  removedAgents: string[]
  removedSkills: string[]
  removedRules: boolean
  removedBin: boolean
  errors: string[]
}

/**
 * Uninstall workflows by removing their command files
 */
export async function uninstallWorkflows(installDir: string): Promise<UninstallResult> {
  const result: UninstallResult = {
    success: true,
    removedCommands: [],
    removedPrompts: [],
    removedAgents: [],
    removedSkills: [],
    removedRules: false,
    removedBin: false,
    errors: [],
  }

  const commandsDir = join(installDir, 'commands', 'ccg')
  const promptsDir = join(installDir, '.ccg', 'prompts')
  const agentsDir = join(installDir, 'agents', 'ccg')
  const skillsDir = join(installDir, 'skills', 'ccg')
  const rulesDir = join(installDir, 'rules')
  const binDir = join(installDir, 'bin')
  const ccgConfigDir = join(installDir, '.ccg')

  // Remove CCG commands directory
  if (await fs.pathExists(commandsDir)) {
    try {
      // Get list for reporting
      const files = await fs.readdir(commandsDir)
      for (const file of files) {
        if (file.endsWith('.md')) {
          result.removedCommands.push(file.replace('.md', ''))
        }
      }

      // Force remove the entire directory
      await fs.remove(commandsDir)
    }
    catch (error) {
      result.errors.push(`Failed to remove commands directory: ${error}`)
      result.success = false
    }
  }

  // Remove CCG agents directory
  if (await fs.pathExists(agentsDir)) {
    try {
      // Get list for reporting
      const files = await fs.readdir(agentsDir)
      for (const file of files) {
        result.removedAgents.push(file.replace('.md', ''))
      }

      // Force remove the entire directory
      await fs.remove(agentsDir)
    }
    catch (error) {
      result.errors.push(`Failed to remove agents directory: ${error}`)
      result.success = false
    }
  }

  // Remove CCG skills directory only (skills/ccg/) — preserves user's own skills in skills/
  if (await fs.pathExists(skillsDir)) {
    try {
      // Collect skill names for reporting (SKILL.md files, excluding root)
      const collectSkillNames = async (dir: string, depth: number): Promise<string[]> => {
        const names: string[] = []
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            names.push(...await collectSkillNames(join(dir, entry.name), depth + 1))
          }
          else if (entry.name === 'SKILL.md' && depth > 0) {
            // Use parent directory name as skill name
            const parts = dir.split('/')
            names.push(parts[parts.length - 1])
          }
        }
        return names
      }
      result.removedSkills = await collectSkillNames(skillsDir, 0)

      // Remove entire skills directory
      await fs.remove(skillsDir)
    }
    catch (error) {
      result.errors.push(`Failed to remove skills: ${error}`)
      result.success = false
    }
  }

  // Remove CCG rules files (rules/ccg-skills.md, rules/ccg-grok-search.md)
  if (await fs.pathExists(rulesDir)) {
    try {
      const ccgRuleFiles = ['ccg-skills.md', 'ccg-grok-search.md']
      for (const ruleFile of ccgRuleFiles) {
        const rulePath = join(rulesDir, ruleFile)
        if (await fs.pathExists(rulePath)) {
          await fs.remove(rulePath)
          result.removedRules = true
        }
      }
    }
    catch (error) {
      result.errors.push(`Failed to remove rules: ${error}`)
    }
  }

  // Remove CCG prompts directory (in .ccg/) - handled by removing .ccg dir below

  // Remove codeagent-wrapper binary
  if (await fs.pathExists(binDir)) {
    try {
      const wrapperName = process.platform === 'win32' ? 'codeagent-wrapper.exe' : 'codeagent-wrapper'
      const wrapperPath = join(binDir, wrapperName)
      if (await fs.pathExists(wrapperPath)) {
        await fs.remove(wrapperPath)
        result.removedBin = true
      }
    }
    catch (error) {
      result.errors.push(`Failed to remove binary: ${error}`)
      result.success = false
    }
  }

  // Remove .ccg config directory (Force remove)
  if (await fs.pathExists(ccgConfigDir)) {
    try {
      await fs.remove(ccgConfigDir)
      result.removedPrompts.push('ALL_PROMPTS_AND_CONFIGS')
    }
    catch (error) {
      result.errors.push(`Failed to remove .ccg directory: ${error}`)
      // Don't mark as failure just for config, but good to know
    }
  }

  return result
}

/**
 * Uninstall ace-tool MCP configuration from ~/.claude.json
 */
export async function uninstallAceTool(): Promise<{ success: boolean, message: string }> {
  try {
    const existingConfig = await readClaudeCodeConfig()

    if (!existingConfig) {
      return {
        success: true,
        message: 'No ~/.claude.json found, nothing to remove',
      }
    }

    // Check if ace-tool exists
    if (!existingConfig.mcpServers || !existingConfig.mcpServers['ace-tool']) {
      return {
        success: true,
        message: 'ace-tool MCP not found in config',
      }
    }

    // Backup before modifying
    await backupClaudeCodeConfig()

    // Remove ace-tool from mcpServers
    delete existingConfig.mcpServers['ace-tool']

    // Write back
    await writeClaudeCodeConfig(existingConfig)

    return {
      success: true,
      message: 'ace-tool MCP removed from ~/.claude.json',
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to uninstall ace-tool: ${error}`,
    }
  }
}

export async function installAceTool(config: AceToolConfig): Promise<{ success: boolean, message: string, configPath?: string }> {
  const { baseUrl, token } = config

  try {
    // Read existing config or create new one
    let existingConfig = await readClaudeCodeConfig()

    if (!existingConfig) {
      existingConfig = { mcpServers: {} }
    }

    // Backup before modifying (if config exists)
    if (existingConfig.mcpServers && Object.keys(existingConfig.mcpServers).length > 0) {
      const backupPath = await backupClaudeCodeConfig()
      if (backupPath) {
        console.log(`  ✓ Backup created: ${backupPath}`)
      }
    }

    // Build args array (with -y flag for npx auto-confirm)
    const args = ['-y', 'ace-tool@latest']
    if (baseUrl) {
      args.push('--base-url', baseUrl)
    }
    if (token) {
      args.push('--token', token)
    }

    // Create base ace-tool MCP server config
    const aceToolConfig = buildMcpServerConfig({
      type: 'stdio' as const,
      command: 'npx',
      args,
    })

    // Merge new server into existing config
    let mergedConfig = mergeMcpServers(existingConfig, {
      'ace-tool': aceToolConfig,
    })

    // Apply Windows fixes if needed
    if (isWindows()) {
      mergedConfig = fixWindowsMcpConfig(mergedConfig)
      console.log('  ✓ Applied Windows MCP configuration fixes')
    }

    // Write config back (preserve all other fields)
    await writeClaudeCodeConfig(mergedConfig)

    return {
      success: true,
      message: isWindows()
        ? 'ace-tool MCP configured successfully with Windows compatibility'
        : 'ace-tool MCP configured successfully',
      configPath: join(homedir(), '.claude.json'),
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to configure ace-tool: ${error}`,
    }
  }
}

/**
 * Install and configure ace-tool-rs MCP for Claude Code
 * ace-tool-rs is a Rust implementation of ace-tool, more lightweight and faster
 */
export async function installAceToolRs(config: AceToolConfig): Promise<{ success: boolean, message: string, configPath?: string }> {
  const { baseUrl, token } = config

  try {
    // Read existing config or create new one
    let existingConfig = await readClaudeCodeConfig()

    if (!existingConfig) {
      existingConfig = { mcpServers: {} }
    }

    // Backup before modifying (if config exists)
    if (existingConfig.mcpServers && Object.keys(existingConfig.mcpServers).length > 0) {
      const backupPath = await backupClaudeCodeConfig()
      if (backupPath) {
        console.log(`  ✓ Backup created: ${backupPath}`)
      }
    }

    // Build args array for ace-tool-rs
    const args = ['ace-tool-rs']
    if (baseUrl) {
      args.push('--base-url', baseUrl)
    }
    if (token) {
      args.push('--token', token)
    }

    // Create base ace-tool-rs MCP server config
    const aceToolRsConfig = buildMcpServerConfig({
      type: 'stdio' as const,
      command: 'npx',
      args,
      env: {
        RUST_LOG: 'info',
      },
    })

    // Merge new server into existing config
    let mergedConfig = mergeMcpServers(existingConfig, {
      'ace-tool': aceToolRsConfig,
    })

    // Apply Windows fixes if needed
    if (isWindows()) {
      mergedConfig = fixWindowsMcpConfig(mergedConfig)
      console.log('  ✓ Applied Windows MCP configuration fixes')
    }

    // Write config back (preserve all other fields)
    await writeClaudeCodeConfig(mergedConfig)

    return {
      success: true,
      message: isWindows()
        ? 'ace-tool-rs MCP configured successfully with Windows compatibility'
        : 'ace-tool-rs MCP configured successfully',
      configPath: join(homedir(), '.claude.json'),
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to configure ace-tool-rs: ${error}`,
    }
  }
}

/**
 * ContextWeaver MCP configuration
 */
export interface ContextWeaverConfig {
  siliconflowApiKey: string
}

/**
 * Install and configure ContextWeaver MCP for Claude Code
 * ContextWeaver is a local-first semantic code search engine with hybrid search + rerank
 */
export async function installContextWeaver(config: ContextWeaverConfig): Promise<{ success: boolean, message: string, configPath?: string }> {
  const { siliconflowApiKey } = config

  try {
    // 0. Install contextweaver CLI globally
    console.log('  ⏳ 正在安装 ContextWeaver CLI...')
    const { execSync } = await import('node:child_process')
    try {
      execSync('npm install -g @hsingjui/contextweaver', { stdio: 'pipe' })
      console.log('  ✓ ContextWeaver CLI 安装成功')
    }
    catch {
      // Try with sudo on Unix systems
      if (process.platform !== 'win32') {
        try {
          execSync('sudo npm install -g @hsingjui/contextweaver', { stdio: 'pipe' })
          console.log('  ✓ ContextWeaver CLI 安装成功 (sudo)')
        }
        catch {
          console.log('  ⚠ ContextWeaver CLI 安装失败，请手动运行: npm install -g @hsingjui/contextweaver')
        }
      }
      else {
        console.log('  ⚠ ContextWeaver CLI 安装失败，请手动运行: npm install -g @hsingjui/contextweaver')
      }
    }

    // 1. Create ContextWeaver config directory and .env file
    const contextWeaverDir = join(homedir(), '.contextweaver')
    await fs.ensureDir(contextWeaverDir)

    const envContent = `# ContextWeaver 配置 (由 CCG 自动生成)

# Embedding API - 硅基流动
EMBEDDINGS_API_KEY=${siliconflowApiKey}
EMBEDDINGS_BASE_URL=https://api.siliconflow.cn/v1/embeddings
EMBEDDINGS_MODEL=Qwen/Qwen3-Embedding-8B
EMBEDDINGS_MAX_CONCURRENCY=10
EMBEDDINGS_DIMENSIONS=1024

# Reranker - 硅基流动
RERANK_API_KEY=${siliconflowApiKey}
RERANK_BASE_URL=https://api.siliconflow.cn/v1/rerank
RERANK_MODEL=Qwen/Qwen3-Reranker-8B
RERANK_TOP_N=20
`
    await fs.writeFile(join(contextWeaverDir, '.env'), envContent, 'utf-8')

    // 2. Read existing Claude Code config
    let existingConfig = await readClaudeCodeConfig()
    if (!existingConfig) {
      existingConfig = { mcpServers: {} }
    }

    // Backup before modifying
    if (existingConfig.mcpServers && Object.keys(existingConfig.mcpServers).length > 0) {
      const backupPath = await backupClaudeCodeConfig()
      if (backupPath) {
        console.log(`  ✓ Backup created: ${backupPath}`)
      }
    }

    // 3. Build ContextWeaver MCP server config
    const contextWeaverMcpConfig = buildMcpServerConfig({
      type: 'stdio' as const,
      command: 'contextweaver',
      args: ['mcp'],
    })

    // 4. Merge into existing config
    let mergedConfig = mergeMcpServers(existingConfig, {
      contextweaver: contextWeaverMcpConfig,
    })

    // Apply Windows fixes if needed
    if (isWindows()) {
      mergedConfig = fixWindowsMcpConfig(mergedConfig)
    }

    // 5. Write config back
    await writeClaudeCodeConfig(mergedConfig)

    return {
      success: true,
      message: 'ContextWeaver MCP configured successfully',
      configPath: join(homedir(), '.claude.json'),
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to configure ContextWeaver: ${error}`,
    }
  }
}

/**
 * Uninstall ContextWeaver MCP from Claude Code
 */
export async function uninstallContextWeaver(): Promise<{ success: boolean, message: string }> {
  try {
    // 1. Remove from claude.json
    const existingConfig = await readClaudeCodeConfig()
    if (existingConfig?.mcpServers?.contextweaver) {
      delete existingConfig.mcpServers.contextweaver
      await writeClaudeCodeConfig(existingConfig)
    }

    // 2. Optionally remove ~/.contextweaver directory (keep it for now, user might want to keep config)
    // const contextWeaverDir = join(homedir(), '.contextweaver')
    // await fs.remove(contextWeaverDir)

    return {
      success: true,
      message: 'ContextWeaver MCP uninstalled successfully',
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to uninstall ContextWeaver: ${error}`,
    }
  }
}

/**
 * Install and configure Fast Context (Windsurf) MCP for Claude Code
 * Fast Context uses Windsurf's AI-powered code search — no full-repo indexing needed
 */
export async function installFastContext(config: FastContextConfig): Promise<{ success: boolean, message: string, configPath?: string }> {
  const { apiKey, includeSnippets } = config

  try {
    let existingConfig = await readClaudeCodeConfig()
    if (!existingConfig) {
      existingConfig = { mcpServers: {} }
    }

    // Backup before modifying
    if (existingConfig.mcpServers && Object.keys(existingConfig.mcpServers).length > 0) {
      const backupPath = await backupClaudeCodeConfig()
      if (backupPath) {
        console.log(`  ✓ Backup created: ${backupPath}`)
      }
    }

    // Build env
    const env: Record<string, string> = {}
    if (apiKey) {
      env.WINDSURF_API_KEY = apiKey
    }
    if (includeSnippets) {
      env.FC_INCLUDE_SNIPPETS = 'true'
    }

    // Build fast-context MCP server config
    const fastContextConfig = buildMcpServerConfig({
      type: 'stdio' as const,
      command: 'npx',
      args: ['-y', '--prefer-online', 'fast-context-mcp@latest'],
      ...(Object.keys(env).length > 0 ? { env } : {}),
    })

    // Merge into existing config
    let mergedConfig = mergeMcpServers(existingConfig, {
      'fast-context': fastContextConfig,
    })

    if (isWindows()) {
      mergedConfig = fixWindowsMcpConfig(mergedConfig)
      console.log('  ✓ Applied Windows MCP configuration fixes')
    }

    await writeClaudeCodeConfig(mergedConfig)

    return {
      success: true,
      message: isWindows()
        ? 'fast-context MCP configured successfully with Windows compatibility'
        : 'fast-context MCP configured successfully',
      configPath: join(homedir(), '.claude.json'),
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to configure fast-context: ${error}`,
    }
  }
}

/**
 * Uninstall Fast Context MCP from Claude Code
 */
export async function uninstallFastContext(): Promise<{ success: boolean, message: string }> {
  try {
    const existingConfig = await readClaudeCodeConfig()
    if (existingConfig?.mcpServers?.['fast-context']) {
      delete existingConfig.mcpServers['fast-context']
      await writeClaudeCodeConfig(existingConfig)
    }

    return {
      success: true,
      message: 'fast-context MCP uninstalled successfully',
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to uninstall fast-context: ${error}`,
    }
  }
}

// ═══════════════════════════════════════════════════════
// Fast Context global prompt injection
// ═══════════════════════════════════════════════════════

const FAST_CONTEXT_PROMPT = `# fast-context MCP 工具使用指南

## 核心原则

**任何需要理解代码上下文、探索性搜索、或自然语言定位代码的场景，优先使用 \`mcp__fast-context__fast_context_search\`**

## 使用场景

### 必须用 fast_context_search
- 探索性搜索（不确定代码在哪个文件/目录）
- 用自然语言描述要找的逻辑（如"部署流程"、"事件处理"）
- 理解业务逻辑和调用链路
- 跨模块、跨层级查询（如从 router 追到 service 到 model）
- 新任务开始前的代码调研和架构理解
- 中文语义搜索（工具支持中英文双语查询）

### 根据需求选择工具
- **语义搜索 / 不确定位置** → \`mcp__fast-context__fast_context_search\`（返回文件+行号范围+grep关键词建议）
- **精确关键词搜索** → Grep
- **已知文件路径，查看内容** → Read
- **按文件名模式查找** → Glob
- **编辑已有文件** → Edit

### fast_context_search 参数调优
- \`tree_depth=1, max_turns=1\` — 快速粗查，适合小项目或初步定位
- \`tree_depth=3, max_turns=3\`（默认）— 平衡精度与速度，适合大多数场景
- \`max_turns=5\` — 深度搜索，适合复杂调用链追踪
- \`project_path\` — 指定搜索的项目根目录，默认为当前工作目录

### 禁止行为
- ❌ 猜测代码位置（"应该在 service/firmware 里"）
- ❌ 跳过搜索直接回答（"根据框架惯例，应该是..."）
- ❌ 遇到搜索就启动子代理（fast-context + Grep 组合优先）

### 子代理使用条件
仅当需要读取 10+ 文件交叉比对、或多轮搜索会撑爆上下文时，才启动子代理。
`

const FC_MARKER_START = '<!-- CCG-FAST-CONTEXT-START -->'
const FC_MARKER_END = '<!-- CCG-FAST-CONTEXT-END -->'

/**
 * Write fast-context search guidance to:
 * 1. ~/.claude/rules/ccg-fast-context.md (Claude Code — auto-loaded via rules/)
 * 2. ~/.codex/AGENTS.md (Codex CLI — auto-loaded as global instructions)
 * 3. ~/.gemini/GEMINI.md (Gemini CLI — auto-loaded as global instructions)
 */
export async function writeFastContextPrompt(): Promise<void> {
  const markerStart = FC_MARKER_START
  const markerEnd = FC_MARKER_END
  const markedBlock = `\n${markerStart}\n${FAST_CONTEXT_PROMPT}\n${markerEnd}\n`
  const markerRegex = new RegExp(
    `\\n?${markerStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
  )

  // Helper: append or replace marked block in a file
  async function injectIntoFile(filePath: string): Promise<void> {
    const dir = dirname(filePath)
    await fs.ensureDir(dir)
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf-8')
      if (content.includes(markerStart)) {
        content = content.replace(markerRegex, markedBlock)
      }
      else {
        content += markedBlock
      }
      await fs.writeFile(filePath, content, 'utf-8')
    }
    else {
      await fs.writeFile(filePath, markedBlock.trim() + '\n', 'utf-8')
    }
  }

  // 1. Claude Code rules (standalone file, not appended)
  const rulesDir = join(homedir(), '.claude', 'rules')
  await fs.ensureDir(rulesDir)
  await fs.writeFile(join(rulesDir, 'ccg-fast-context.md'), FAST_CONTEXT_PROMPT, 'utf-8')

  // 2. Codex CLI global instructions (~/.codex/AGENTS.md)
  await injectIntoFile(join(homedir(), '.codex', 'AGENTS.md'))

  // 3. Gemini CLI global instructions (~/.gemini/GEMINI.md)
  await injectIntoFile(join(homedir(), '.gemini', 'GEMINI.md'))
}

/**
 * Remove fast-context prompts from all locations
 */
export async function removeFastContextPrompt(): Promise<void> {
  const markerRegex = new RegExp(
    `\\n?${FC_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${FC_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
  )

  // Helper: remove marked block from a file
  async function removeFromFile(filePath: string): Promise<void> {
    if (await fs.pathExists(filePath)) {
      let content = await fs.readFile(filePath, 'utf-8')
      if (content.includes(FC_MARKER_START)) {
        content = content.replace(markerRegex, '')
        await fs.writeFile(filePath, content, 'utf-8')
      }
    }
  }

  // 1. Remove Claude Code rules file
  const rulePath = join(homedir(), '.claude', 'rules', 'ccg-fast-context.md')
  if (await fs.pathExists(rulePath)) {
    await fs.remove(rulePath)
  }

  // 2. Remove from Codex AGENTS.md
  await removeFromFile(join(homedir(), '.codex', 'AGENTS.md'))

  // 3. Remove from Gemini GEMINI.md
  await removeFromFile(join(homedir(), '.gemini', 'GEMINI.md'))
}

/**
 * Install a generic MCP server to Claude Code
 */
export async function installMcpServer(
  id: string,
  command: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<{ success: boolean, message: string }> {
  try {
    await backupClaudeCodeConfig()
    const existingConfig = await readClaudeCodeConfig()

    const serverConfig = buildMcpServerConfig({ type: 'stdio', command, args, env })

    let mergedConfig = mergeMcpServers(existingConfig, { [id]: serverConfig })
    if (isWindows()) {
      mergedConfig = fixWindowsMcpConfig(mergedConfig)
    }

    await writeClaudeCodeConfig(mergedConfig)

    return { success: true, message: `${id} MCP installed successfully` }
  }
  catch (error) {
    return { success: false, message: `Failed to install ${id}: ${error}` }
  }
}

/**
 * Uninstall a generic MCP server from Claude Code
 */
export async function uninstallMcpServer(id: string): Promise<{ success: boolean, message: string }> {
  try {
    const existingConfig = await readClaudeCodeConfig()
    if (existingConfig?.mcpServers?.[id]) {
      delete existingConfig.mcpServers[id]
      await writeClaudeCodeConfig(existingConfig)
    }

    return { success: true, message: `${id} MCP uninstalled successfully` }
  }
  catch (error) {
    return { success: false, message: `Failed to uninstall ${id}: ${error}` }
  }
}

// ═══════════════════════════════════════════════════════
// Codex MCP Sync — Mirror CCG-relevant MCP servers
// from Claude (~/.claude.json) to Codex (~/.codex/config.toml)
// ═══════════════════════════════════════════════════════

/** MCP server IDs that CCG manages and should sync to Codex */
const CCG_MCP_IDS = new Set([
  'grok-search',
  'context7',
  'ace-tool',
  'ace-tool-rs',
  'contextweaver',
  'fast-context',
])

/**
 * Sync (mirror) CCG-managed MCP servers from Claude's ~/.claude.json
 * to Codex's ~/.codex/config.toml
 *
 * - Only touches servers in CCG_MCP_IDS — user's custom MCP servers are untouched.
 * - Servers present in Claude are added/updated with ALL fields (not just command/args/env).
 * - Servers absent from Claude but present in Codex (within CCG_MCP_IDS) are REMOVED.
 * - Preserves all existing Codex config (model_provider, model, etc.)
 * - Uses atomic write (temp file + rename) to prevent corruption.
 */
export async function syncMcpToCodex(): Promise<{
  success: boolean
  message: string
  synced: string[]
  removed: string[]
}> {
  const synced: string[] = []
  const removed: string[] = []

  try {
    // 1. Read Claude's MCP config
    const claudeConfig = await readClaudeCodeConfig()
    const claudeMcpServers = claudeConfig?.mcpServers || {}

    // Filter to only CCG-managed servers that actually exist in Claude
    const serversToSync: Record<string, any> = {}
    for (const [id, config] of Object.entries(claudeMcpServers)) {
      if (CCG_MCP_IDS.has(id) && config) {
        serversToSync[id] = config
      }
    }

    // 2. Read or create Codex config
    const codexConfigDir = join(homedir(), '.codex')
    const codexConfigPath = join(codexConfigDir, 'config.toml')
    await fs.ensureDir(codexConfigDir)

    let codexConfig: Record<string, any> = {}
    if (await fs.pathExists(codexConfigPath)) {
      const content = await fs.readFile(codexConfigPath, 'utf-8')
      codexConfig = parseToml(content) as Record<string, any>
    }

    // 3. Ensure mcp_servers table exists
    if (!codexConfig.mcp_servers) {
      codexConfig.mcp_servers = {}
    }

    // 4. Mirror: add/update CCG servers (pass through ALL fields, not just command/args/env)
    for (const [id, claudeServer] of Object.entries(serversToSync)) {
      const server = claudeServer as Record<string, any>
      const codexEntry: Record<string, any> = {}

      // Pass through all TOML-compatible fields from Claude config
      for (const [key, value] of Object.entries(server)) {
        if (value !== null && value !== undefined) {
          codexEntry[key] = value
        }
      }

      codexConfig.mcp_servers[id] = codexEntry
      synced.push(id)
    }

    // 5. Mirror: remove CCG servers that no longer exist in Claude
    for (const id of CCG_MCP_IDS) {
      if (!serversToSync[id] && codexConfig.mcp_servers[id]) {
        delete codexConfig.mcp_servers[id]
        removed.push(id)
      }
    }

    // Skip write if no changes needed
    if (synced.length === 0 && removed.length === 0) {
      return {
        success: true,
        message: 'No CCG MCP servers to sync or remove',
        synced: [],
        removed: [],
      }
    }

    // 6. Atomic write: temp file + rename to prevent corruption
    const tmpPath = `${codexConfigPath}.tmp`
    await fs.writeFile(tmpPath, stringifyToml(codexConfig), 'utf-8')
    await fs.rename(tmpPath, codexConfigPath)

    const parts: string[] = []
    if (synced.length > 0) parts.push(`synced: ${synced.join(', ')}`)
    if (removed.length > 0) parts.push(`removed: ${removed.join(', ')}`)

    return {
      success: true,
      message: `Codex MCP mirror complete (${parts.join('; ')})`,
      synced,
      removed,
    }
  }
  catch (error) {
    return {
      success: false,
      message: `Failed to sync MCP to Codex: ${error}`,
      synced,
      removed,
    }
  }
}

/**
 * Sync (mirror) CCG-managed MCP servers from Claude's ~/.claude.json
 * to Gemini CLI's ~/.gemini/settings.json
 *
 * Same logic as syncMcpToCodex but targets Gemini's JSON config format.
 */
export async function syncMcpToGemini(): Promise<{
  success: boolean
  message: string
  synced: string[]
  removed: string[]
}> {
  const synced: string[] = []
  const removed: string[] = []

  try {
    // 1. Read Claude's MCP config
    const claudeConfig = await readClaudeCodeConfig()
    const claudeMcpServers = claudeConfig?.mcpServers || {}

    // Filter to only CCG-managed servers
    const serversToSync: Record<string, any> = {}
    for (const [id, config] of Object.entries(claudeMcpServers)) {
      if (CCG_MCP_IDS.has(id) && config) {
        serversToSync[id] = config
      }
    }

    // 2. Read or create Gemini settings
    const geminiDir = join(homedir(), '.gemini')
    const geminiSettingsPath = join(geminiDir, 'settings.json')
    await fs.ensureDir(geminiDir)

    let geminiSettings: Record<string, any> = {}
    if (await fs.pathExists(geminiSettingsPath)) {
      geminiSettings = await fs.readJSON(geminiSettingsPath)
    }

    // 3. Ensure mcpServers exists
    if (!geminiSettings.mcpServers) {
      geminiSettings.mcpServers = {}
    }

    // 4. Mirror: add/update CCG servers
    for (const [id, claudeServer] of Object.entries(serversToSync)) {
      geminiSettings.mcpServers[id] = claudeServer
      synced.push(id)
    }

    // 5. Mirror: remove CCG servers that no longer exist in Claude
    for (const id of CCG_MCP_IDS) {
      if (!serversToSync[id] && geminiSettings.mcpServers[id]) {
        delete geminiSettings.mcpServers[id]
        removed.push(id)
      }
    }

    if (synced.length === 0 && removed.length === 0) {
      return { success: true, message: 'No CCG MCP servers to sync to Gemini', synced: [], removed: [] }
    }

    // 6. Write back (preserve all other Gemini settings)
    await fs.writeJSON(geminiSettingsPath, geminiSettings, { spaces: 2 })

    const parts: string[] = []
    if (synced.length > 0) parts.push(`synced: ${synced.join(', ')}`)
    if (removed.length > 0) parts.push(`removed: ${removed.join(', ')}`)

    return { success: true, message: `Gemini MCP mirror complete (${parts.join('; ')})`, synced, removed }
  }
  catch (error) {
    return { success: false, message: `Failed to sync MCP to Gemini: ${error}`, synced, removed }
  }
}
