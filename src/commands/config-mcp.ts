import ansis from 'ansis'
import inquirer from 'inquirer'
import { i18n } from '../i18n'
import fs from 'fs-extra'
import { homedir } from 'node:os'
import { join } from 'pathe'
import { installAceTool, installAceToolRs, installContextWeaver, installFastContext, installMcpServer, removeFastContextPrompt, uninstallAceTool, uninstallContextWeaver, uninstallFastContext, uninstallMcpServer, writeFastContextPrompt } from '../utils/installer'

/**
 * Configure MCP tools after installation
 */
export async function configMcp(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`  配置 MCP 工具`))
  console.log()

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: '选择操作',
    choices: [
      { name: `${ansis.green('➜')} 代码检索 MCP ${ansis.gray('(ace-tool / fast-context / ContextWeaver)')}`, value: 'code-retrieval' },
      { name: `${ansis.green('➜')} 联网搜索 MCP ${ansis.gray('(grok-search，比内置联网更好用)')}`, value: 'grok-search' },
      { name: `${ansis.blue('➜')} 辅助工具 MCP ${ansis.gray('(context7 / Playwright / exa...)')}`, value: 'auxiliary' },
      { name: `${ansis.red('✕')} 卸载 MCP`, value: 'uninstall' },
      new inquirer.Separator(),
      { name: `${ansis.gray('返回')}`, value: 'cancel' },
    ],
  }])

  if (action === 'cancel')
    return

  if (action === 'code-retrieval') {
    await handleCodeRetrieval()
  }
  else if (action === 'grok-search') {
    await handleGrokSearch()
  }
  else if (action === 'auxiliary') {
    await handleAuxiliary()
  }
  else if (action === 'uninstall') {
    await handleUninstall()
  }
}

async function handleCodeRetrieval(): Promise<void> {
  console.log()

  const { tool } = await inquirer.prompt([{
    type: 'list',
    name: 'tool',
    message: '选择代码检索工具',
    choices: [
      { name: `ace-tool ${ansis.green('(推荐)')} ${ansis.gray('- 代码检索（enhance_prompt 已不可用）')}`, value: 'ace-tool' },
      { name: `ace-tool-rs ${ansis.green('(推荐)')} ${ansis.gray('- Rust 版本')}`, value: 'ace-tool-rs' },
      { name: `fast-context ${ansis.green('(推荐)')} ${ansis.gray('- Windsurf Fast Context（免费/低成本）')}`, value: 'fast-context' },
      { name: `ContextWeaver ${ansis.gray('- 本地混合搜索（需硅基流动 API Key）')}`, value: 'contextweaver' },
      new inquirer.Separator(),
      { name: `${ansis.gray('返回')}`, value: 'cancel' },
    ],
  }])

  if (tool === 'cancel')
    return

  if (tool === 'contextweaver') {
    await handleInstallContextWeaver()
  }
  else if (tool === 'fast-context') {
    await handleInstallFastContext()
  }
  else {
    await handleInstallAceTool(tool === 'ace-tool-rs')
  }
}

async function handleInstallAceTool(isRs: boolean): Promise<void> {
  const toolName = isRs ? 'ace-tool-rs' : 'ace-tool'

  console.log()
  console.log(ansis.cyan(`📖 获取 ${toolName} 访问方式：`))
  console.log(`   ${ansis.gray('•')} ${ansis.cyan('官方服务')}: ${ansis.underline('https://augmentcode.com/')}`)
  console.log(`   ${ansis.gray('•')} ${ansis.cyan('第三方中转')} ${ansis.green('(推荐)')}: ${ansis.underline('https://acemcp.heroman.wtf/')}`)
  console.log(`   ${ansis.gray('⚠')} ${ansis.yellow('注意')}: enhance_prompt 已不可用，search_context 代码检索正常`)
  console.log()

  const answers = await inquirer.prompt([
    { type: 'input', name: 'baseUrl', message: `Base URL ${ansis.gray('(中转服务必填，官方留空)')}` },
    { type: 'password', name: 'token', message: `Token ${ansis.gray('(必填)')}`, validate: (v: string) => v.trim() !== '' || '请输入 Token' },
  ])

  console.log()
  console.log(ansis.yellow(`⏳ 正在配置 ${toolName} MCP...`))

  const result = await (isRs ? installAceToolRs : installAceTool)({
    baseUrl: answers.baseUrl?.trim() || undefined,
    token: answers.token.trim(),
  })

  console.log()
  if (result.success) {
    console.log(ansis.green(`✓ ${toolName} MCP 配置成功！`))
    console.log(ansis.gray(`  重启 Claude Code CLI 使配置生效`))
  }
  else {
    console.log(ansis.red(`✗ ${toolName} MCP 配置失败: ${result.message}`))
  }
}

async function handleInstallContextWeaver(): Promise<void> {
  console.log()
  console.log(ansis.cyan(`📖 获取硅基流动 API Key：`))
  console.log(`   ${ansis.gray('1.')} 访问 ${ansis.underline('https://siliconflow.cn/')} 注册账号`)
  console.log(`   ${ansis.gray('2.')} 进入控制台 → API 密钥 → 创建密钥`)
  console.log(`   ${ansis.gray('3.')} 新用户有免费额度，Embedding + Rerank 完全够用`)
  console.log()

  const { apiKey } = await inquirer.prompt([{
    type: 'password',
    name: 'apiKey',
    message: `硅基流动 API Key ${ansis.gray('(sk-xxx)')}`,
    mask: '*',
    validate: (v: string) => v.trim() !== '' || '请输入 API Key',
  }])

  console.log()
  console.log(ansis.yellow('⏳ 正在配置 ContextWeaver MCP...'))

  const result = await installContextWeaver({ siliconflowApiKey: apiKey.trim() })

  console.log()
  if (result.success) {
    console.log(ansis.green('✓ ContextWeaver MCP 配置成功！'))
    console.log(ansis.gray('  重启 Claude Code CLI 使配置生效'))
  }
  else {
    console.log(ansis.red(`✗ ContextWeaver MCP 配置失败: ${result.message}`))
  }
}

async function handleInstallFastContext(): Promise<void> {
  console.log()
  console.log(ansis.cyan('📖 Fast Context (Windsurf Fast Context)：'))
  console.log(`   ${ansis.gray('•')} 需要 Windsurf 账号的 API Key`)
  console.log(`   ${ansis.gray('•')} 本地装过 Windsurf 并登录 → Key 可自动提取，也可手动填入`)
  console.log(`   ${ansis.gray('•')} Key 获取：安装 Windsurf → 登录 → 从本地 SQLite 提取 apiKey`)
  console.log(`   ${ansis.gray('•')} 轻量模式返回文件路径+行范围，完整模式额外返回代码片段`)
  console.log()

  const answers = await inquirer.prompt([
    { type: 'input', name: 'apiKey', message: `WINDSURF_API_KEY ${ansis.gray('(本地装了 Windsurf 可留空自动提取)')}` },
    {
      type: 'confirm',
      name: 'includeSnippets',
      message: `返回完整代码片段？${ansis.gray('(FC_INCLUDE_SNIPPETS，输出 ~40KB，否则仅路径+行号 ~2KB)')}`,
      default: false,
    },
  ])

  console.log()
  console.log(ansis.yellow('⏳ 正在配置 fast-context MCP...'))

  const result = await installFastContext({
    apiKey: answers.apiKey?.trim() || undefined,
    includeSnippets: answers.includeSnippets,
  })

  console.log()
  if (result.success) {
    // Write search guidance to Claude Code rules + Codex global instructions
    await writeFastContextPrompt()
    console.log(ansis.green('✓ fast-context MCP 配置成功！'))
    console.log(ansis.green('✓ 搜索提示词已写入 ~/.claude/rules/ + ~/.codex/AGENTS.md + ~/.gemini/GEMINI.md'))
    console.log(ansis.gray('  重启 Claude Code CLI 使配置生效'))
  }
  else {
    console.log(ansis.red(`✗ fast-context MCP 配置失败: ${result.message}`))
  }
}

// ═══════════════════════════════════════════════════════
// Grok Search MCP (web search)
// ═══════════════════════════════════════════════════════

const GROK_SEARCH_PROMPT = `## 0. Language and Format Standards

- **Interaction Language**: Tools and models must interact exclusively in **English**; user outputs must be in **Chinese**.
- MUST ULRTA Thinking in ENGLISH!
- **Formatting Requirements**: Use standard Markdown formatting. Code blocks and specific text results should be marked with backticks. Skilled in applying four or more \`\`\`\`markdown wrappers.

## 1. Search and Evidence Standards
Typically, the results of web searches only constitute third-party suggestions and are not directly credible; they must be cross-verified with sources to provide users with absolutely authoritative and correct answers.

### Search Trigger Conditions
Strictly distinguish between internal and external knowledge. Avoid speculation based on general internal knowledge. When uncertain, explicitly inform the user.

For example, when using the \\\`fastapi\\\` library to encapsulate an API endpoint, despite possessing common-sense knowledge internally, you must still rely on the latest search results or official documentation for reliable implementation.

### Search Execution Guidelines

- Use the \\\`mcp__grok-search\\\` tool for web searches
- Execute independent search requests in parallel; sequential execution applies only when dependencies exist
- Evaluate search results for quality: analyze relevance, source credibility, cross-source consistency, and completeness. Conduct supplementary searches if gaps exist

### Source Quality Standards

- Key factual claims must be supported by >=2 independent sources. If relying on a single source, explicitly state this limitation
- Conflicting sources: Present evidence from both sides, assess credibility and timeliness, identify the stronger evidence, or declare unresolved discrepancies
- Empirical conclusions must include confidence levels (High/Medium/Low)
- Citation format: [Author/Organization, Year/Date, Section/URL]. Fabricated references are strictly prohibited

## 2. Reasoning and Expression Principles

- Be concise, direct, and information-dense: Use lists for discrete items; paragraphs for arguments
- Challenge flawed premises: When user logic contains errors, pinpoint specific issues with evidence
- All conclusions must specify: Applicable conditions, scope boundaries, and known limitations
- Avoid greetings, pleasantries, filler adjectives, and emotional expressions
- When uncertain: State unknowns and reasons before presenting confirmed facts
`

async function writeGrokPromptToRules(): Promise<void> {
  const rulesDir = join(homedir(), '.claude', 'rules')
  const rulePath = join(rulesDir, 'ccg-grok-search.md')

  // Clean up legacy CLAUDE.md injection if present
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md')
  if (await fs.pathExists(claudeMdPath)) {
    const content = await fs.readFile(claudeMdPath, 'utf-8')
    if (content.includes('CCG-GROK-SEARCH-PROMPT')) {
      const cleaned = content.replace(/\n*<!-- CCG-GROK-SEARCH-PROMPT-START -->[\s\S]*?<!-- CCG-GROK-SEARCH-PROMPT-END -->\n*/g, '')
      await fs.writeFile(claudeMdPath, cleaned, 'utf-8')
    }
  }

  await fs.ensureDir(rulesDir)
  await fs.writeFile(rulePath, GROK_SEARCH_PROMPT, 'utf-8')
}

async function handleGrokSearch(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold('  🔍 联网搜索 MCP (grok-search)'))
  console.log(ansis.gray('  比 Claude Code 内置联网更好用'))
  console.log()

  console.log(ansis.cyan('  📖 获取 API Keys：'))
  console.log(`     Tavily: ${ansis.underline('https://www.tavily.com/')} ${ansis.gray('(免费额度 1000次/月)')}`)
  console.log(`     Firecrawl: ${ansis.underline('https://www.firecrawl.dev/')} ${ansis.gray('(注册即送额度)')}`)
  console.log(`     Grok API: ${ansis.gray('需自行部署 grok2api（可选）')}`)
  console.log()

  const answers = await inquirer.prompt([
    { type: 'input', name: 'grokApiUrl', message: `GROK_API_URL ${ansis.gray('(可选)')}`, default: '' },
    { type: 'password', name: 'grokApiKey', message: `GROK_API_KEY ${ansis.gray('(可选)')}`, mask: '*' },
    { type: 'password', name: 'tavilyKey', message: `TAVILY_API_KEY ${ansis.gray('(可选)')}`, mask: '*' },
    { type: 'password', name: 'firecrawlKey', message: `FIRECRAWL_API_KEY ${ansis.gray('(可选)')}`, mask: '*' },
  ])

  const env: Record<string, string> = {}
  if (answers.grokApiUrl?.trim()) env.GROK_API_URL = answers.grokApiUrl.trim()
  if (answers.grokApiKey?.trim()) env.GROK_API_KEY = answers.grokApiKey.trim()
  if (answers.tavilyKey?.trim()) env.TAVILY_API_KEY = answers.tavilyKey.trim()
  if (answers.firecrawlKey?.trim()) env.FIRECRAWL_API_KEY = answers.firecrawlKey.trim()

  if (Object.keys(env).length === 0) {
    console.log(ansis.yellow('  未填写任何 Key，已跳过'))
    return
  }

  console.log()
  console.log(ansis.yellow('⏳ 正在安装 grok-search MCP...'))

  const result = await installMcpServer(
    'grok-search',
    'uvx',
    ['--from', 'git+https://github.com/GuDaStudio/GrokSearch@grok-with-tavily', 'grok-search'],
    env,
  )

  console.log()
  if (result.success) {
    await writeGrokPromptToRules()
    console.log(ansis.green('✓ grok-search MCP 配置成功！'))
    console.log(ansis.green('✓ 全局搜索提示词已写入 ~/.claude/rules/ccg-grok-search.md'))
    console.log(ansis.gray('  重启 Claude Code CLI 使配置生效'))
  }
  else {
    console.log(ansis.red(`✗ grok-search MCP 安装失败: ${result.message}`))
  }
}

// 辅助工具 MCP 配置
const AUXILIARY_MCPS = [
  { id: 'context7', name: 'Context7', desc: '获取最新库文档', command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
  { id: 'Playwright', name: 'Playwright', desc: '浏览器自动化/测试', command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
  { id: 'mcp-deepwiki', name: 'DeepWiki', desc: '知识库查询', command: 'npx', args: ['-y', 'mcp-deepwiki@latest'] },
  { id: 'exa', name: 'Exa', desc: '搜索引擎（需 API Key）', command: 'npx', args: ['-y', 'exa-mcp-server@latest'], requiresApiKey: true, apiKeyEnv: 'EXA_API_KEY' },
]

async function handleAuxiliary(): Promise<void> {
  console.log()

  const { selected } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'selected',
    message: '选择要安装的辅助工具（空格选择，回车确认）',
    choices: AUXILIARY_MCPS.map(m => ({
      name: `${m.name} ${ansis.gray(`- ${m.desc}`)}`,
      value: m.id,
    })),
  }])

  if (!selected || selected.length === 0) {
    console.log(ansis.gray('未选择任何工具'))
    return
  }

  console.log()

  for (const id of selected) {
    const mcp = AUXILIARY_MCPS.find(m => m.id === id)!
    let env: Record<string, string> = {}

    if (mcp.requiresApiKey) {
      console.log(ansis.cyan(`📖 获取 ${mcp.name} API Key：`))
      console.log(`   访问 ${ansis.underline('https://exa.ai/')} 注册获取（有免费额度）`)
      console.log()

      const { apiKey } = await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: `${mcp.name} API Key`,
        mask: '*',
        validate: (v: string) => v.trim() !== '' || '请输入 API Key',
      }])
      env[mcp.apiKeyEnv!] = apiKey.trim()
    }

    console.log(ansis.yellow(`⏳ 正在安装 ${mcp.name}...`))
    const result = await installMcpServer(mcp.id, mcp.command, mcp.args, env)

    if (result.success) {
      console.log(ansis.green(`✓ ${mcp.name} 安装成功`))
    }
    else {
      console.log(ansis.red(`✗ ${mcp.name} 安装失败: ${result.message}`))
    }
  }

  console.log()
  console.log(ansis.gray('重启 Claude Code CLI 使配置生效'))
}

async function handleUninstall(): Promise<void> {
  console.log()

  const allMcps = [
    { name: 'ace-tool', value: 'ace-tool' },
    { name: 'fast-context', value: 'fast-context' },
    { name: 'ContextWeaver', value: 'contextweaver' },
    { name: 'grok-search', value: 'grok-search' },
    ...AUXILIARY_MCPS.map(m => ({ name: m.name, value: m.id })),
  ]

  const { targets } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'targets',
    message: '选择要卸载的 MCP（空格选择，回车确认）',
    choices: allMcps,
  }])

  if (!targets || targets.length === 0) {
    console.log(ansis.gray('未选择任何工具'))
    return
  }

  console.log()

  for (const target of targets) {
    console.log(ansis.yellow(`⏳ 正在卸载 ${target}...`))

    let result
    if (target === 'ace-tool') {
      result = await uninstallAceTool()
    }
    else if (target === 'fast-context') {
      result = await uninstallFastContext()
      // Also remove search guidance prompts
      await removeFastContextPrompt()
    }
    else if (target === 'contextweaver') {
      result = await uninstallContextWeaver()
    }
    else {
      result = await uninstallMcpServer(target)
    }

    if (result.success) {
      console.log(ansis.green(`✓ ${target} 已卸载`))
    }
    else {
      console.log(ansis.red(`✗ ${target} 卸载失败: ${result.message}`))
    }
  }

  console.log()
}
