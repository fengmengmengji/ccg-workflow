import type { CollaborationMode, InitOptions, ModelRouting, ModelType, SupportedLang } from '../types'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { homedir } from 'node:os'
import { join } from 'pathe'
import { i18n, initI18n } from '../i18n'
import { createDefaultConfig, ensureCcgDir, getCcgDir, readCcgConfig, writeCcgConfig } from '../utils/config'
import { getAllCommandIds, installAceTool, installAceToolRs, installContextWeaver, installFastContext, installMcpServer, installWorkflows, showBinaryDownloadWarning, syncMcpToCodex, syncMcpToGemini, writeFastContextPrompt } from '../utils/installer'
import { isWindows } from '../utils/platform'
import { migrateToV1_4_0, needsMigration } from '../utils/migration'

/**
 * Auto-approve codeagent-wrapper Bash commands in settings.json.
 *
 * All platforms use permissions.allow with wildcard pattern (v1.7.89+).
 * Old Hook-based approach and old permission entries are automatically cleaned up.
 */
async function installHook(settingsPath: string): Promise<'permission'> {
  let settings: Record<string, any> = {}
  if (await fs.pathExists(settingsPath)) {
    settings = await fs.readJSON(settingsPath)
  }

  // ── All platforms: permissions.allow approach (v1.7.89+) ──

  // Remove old Hook if it exists (migration from ≤v1.7.88)
  if (settings.hooks?.PreToolUse) {
    const hookIdx = settings.hooks.PreToolUse.findIndex(
      (h: any) => h.matcher === 'Bash' && h.hooks?.some((hh: any) => hh.command?.includes('codeagent-wrapper')),
    )
    if (hookIdx >= 0) {
      settings.hooks.PreToolUse.splice(hookIdx, 1)
      // Clean up empty arrays/objects
      if (settings.hooks.PreToolUse.length === 0)
        delete settings.hooks.PreToolUse
      if (settings.hooks && Object.keys(settings.hooks).length === 0)
        delete settings.hooks
    }
  }

  // Remove old permission entry without leading wildcard (migration from ≤v1.7.88)
  if (settings.permissions?.allow) {
    const oldEntry = 'Bash(codeagent-wrapper*)'
    const oldIdx = settings.permissions.allow.indexOf(oldEntry)
    if (oldIdx >= 0) {
      settings.permissions.allow.splice(oldIdx, 1)
    }
  }

  // Add permissions.allow entry
  if (!settings.permissions)
    settings.permissions = {}
  if (!settings.permissions.allow)
    settings.permissions.allow = []

  const permEntry = 'Bash(*codeagent-wrapper*)'
  if (!settings.permissions.allow.includes(permEntry)) {
    settings.permissions.allow.push(permEntry)
  }

  await fs.writeJSON(settingsPath, settings, { spaces: 2 })
  return 'permission'
}

/**
 * Write grok-search global prompt to ~/.claude/rules/ccg-grok-search.md
 * Uses rules/ directory for modularity — avoids bloating CLAUDE.md
 */
async function appendGrokSearchPrompt(): Promise<void> {
  const rulesDir = join(homedir(), '.claude', 'rules')
  const rulePath = join(rulesDir, 'ccg-grok-search.md')

  // Also clean up legacy CLAUDE.md injection if present
  const claudeMdPath = join(homedir(), '.claude', 'CLAUDE.md')
  if (await fs.pathExists(claudeMdPath)) {
    const content = await fs.readFile(claudeMdPath, 'utf-8')
    if (content.includes('CCG-GROK-SEARCH-PROMPT')) {
      const cleaned = content.replace(/\n*<!-- CCG-GROK-SEARCH-PROMPT-START -->[\s\S]*?<!-- CCG-GROK-SEARCH-PROMPT-END -->\n*/g, '')
      await fs.writeFile(claudeMdPath, cleaned, 'utf-8')
    }
  }

  const prompt = `## 0. Language and Format Standards

- **Interaction Language**: Tools and models must interact exclusively in **English**; user outputs must be in **Chinese**.
- MUST ULRTA Thinking in ENGLISH!
- **Formatting Requirements**: Use standard Markdown formatting. Code blocks and specific text results should be marked with backticks. Skilled in applying four or more \`\`\`\`markdown wrappers.

## 1. Search and Evidence Standards
Typically, the results of web searches only constitute third-party suggestions and are not directly credible; they must be cross-verified with sources to provide users with absolutely authoritative and correct answers.

### Search Trigger Conditions
Strictly distinguish between internal and external knowledge. Avoid speculation based on general internal knowledge. When uncertain, explicitly inform the user.

For example, when using the \`fastapi\` library to encapsulate an API endpoint, despite possessing common-sense knowledge internally, you must still rely on the latest search results or official documentation for reliable implementation.

### Search Execution Guidelines

- Use the \`mcp__grok-search\` tool for web searches
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

  await fs.ensureDir(rulesDir)
  await fs.writeFile(rulePath, prompt, 'utf-8')
}

/**
 * Install grok-search MCP server
 */
async function installGrokSearchMcp(keys: {
  tavilyKey?: string
  firecrawlKey?: string
  grokApiUrl?: string
  grokApiKey?: string
}): Promise<{ success: boolean, message: string }> {
  const env: Record<string, string> = {}
  if (keys.tavilyKey)
    env.TAVILY_API_KEY = keys.tavilyKey
  if (keys.firecrawlKey)
    env.FIRECRAWL_API_KEY = keys.firecrawlKey
  if (keys.grokApiUrl)
    env.GROK_API_URL = keys.grokApiUrl
  if (keys.grokApiKey)
    env.GROK_API_KEY = keys.grokApiKey

  return installMcpServer(
    'grok-search',
    'uvx',
    ['--from', 'git+https://github.com/GuDaStudio/GrokSearch@grok-with-tavily', 'grok-search'],
    env,
  )
}

export async function init(options: InitOptions = {}): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`  CCG - Claude + Codex + Gemini`))
  console.log(ansis.gray(`  Multi-Model Collaboration Workflow`))
  console.log()

  // ═══════════════════════════════════════════════════════
  // Step 0: Language selection (FIRST interactive step)
  // ═══════════════════════════════════════════════════════
  let language: SupportedLang = 'zh-CN'

  if (!options.skipPrompt) {
    // Check if user already has a language preference
    const existingConfig = await readCcgConfig()
    const savedLang = existingConfig?.general?.language

    if (savedLang) {
      // Use saved language
      language = savedLang
      await initI18n(language)
    }
    else {
      // First time user: ask for language
      const { selectedLang } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedLang',
        message: '选择语言 / Select language',
        choices: [
          { name: `简体中文`, value: 'zh-CN' },
          { name: `English`, value: 'en' },
        ],
        default: 'zh-CN',
      }])
      language = selectedLang
      await initI18n(language)
    }
  }
  else if (options.lang) {
    language = options.lang
    await initI18n(language)
  }

  // Model routing configuration (user-selectable since v2.1.0)
  let frontendModels: ModelType[] = ['gemini']
  let backendModels: ModelType[] = ['codex']
  let geminiModel = 'gemini-3.1-pro-preview'
  const mode: CollaborationMode = 'smart'
  const selectedWorkflows = getAllCommandIds()

  // Non-interactive mode: preserve existing config
  if (options.skipPrompt) {
    const existingConfig = await readCcgConfig()
    if (existingConfig?.routing) {
      frontendModels = existingConfig.routing.frontend?.models || ['gemini']
      backendModels = existingConfig.routing.backend?.models || ['codex']
      geminiModel = existingConfig.routing.geminiModel || 'gemini-3.1-pro-preview'
    }
  }

  // Performance mode selection
  let liteMode = false
  let skipImpeccable = false

  // MCP Tool Selection
  let mcpProvider = 'ace-tool'
  let aceToolBaseUrl = ''
  let aceToolToken = ''
  let contextWeaverApiKey = ''
  let fastContextApiKey = ''
  let fastContextIncludeSnippets = false
  let wantFastContext = false

  // Grok Search MCP
  let wantGrokSearch = false
  let tavilyKey = ''
  let firecrawlKey = ''
  let grokApiUrl = ''
  let grokApiKey = ''

  // Claude Code API configuration
  let apiUrl = ''
  let apiKey = ''

  // ═══════════════════════════════════════════════════════
  // Step 1/3: API Provider
  // ═══════════════════════════════════════════════════════
  if (!options.skipPrompt) {
    console.log()
    console.log(ansis.cyan.bold(`  🔑 Step 1/4 — ${i18n.t('init:api.title')}`))
    console.log()

    const { apiProvider } = await inquirer.prompt([{
      type: 'list',
      name: 'apiProvider',
      message: i18n.t('init:api.providerPrompt'),
      choices: [
        { name: `${ansis.green('●')} ${i18n.t('init:api.officialOption')}`, value: 'official' },
        { name: `${ansis.cyan('●')} ${i18n.t('init:api.thirdPartyOption')}`, value: 'thirdparty' },
        { name: `${ansis.yellow('★')} ${i18n.t('init:api.sponsor302AI')} ${ansis.gray('— https://share.302.ai/oUDqQ6')}`, value: '302ai' },
      ],
    }])

    if (apiProvider === '302ai') {
      apiUrl = 'https://api.302.ai/cc'
      console.log()
      console.log(`    ${ansis.yellow('★')} ${i18n.t('init:api.sponsor302AIGetKey')}: ${ansis.cyan.underline('https://share.302.ai/oUDqQ6')}`)
      console.log()
      const { key } = await inquirer.prompt([{
        type: 'password',
        name: 'key',
        message: `302.AI API Key ${ansis.gray(`(${i18n.t('init:api.keyRequired')})`)}`,
        mask: '*',
        validate: (v: string) => v.trim() !== '' || i18n.t('init:api.enterKey'),
      }])
      apiKey = key?.trim() || ''
    }
    else if (apiProvider === 'thirdparty') {
      const apiAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: `API URL ${ansis.gray(`(${i18n.t('init:api.urlRequired')})`)}`,
          validate: (v: string) => v.trim() !== '' || i18n.t('init:api.enterUrl'),
        },
        {
          type: 'password',
          name: 'key',
          message: `API Key ${ansis.gray(`(${i18n.t('init:api.keyRequired')})`)}`,
          mask: '*',
          validate: (v: string) => v.trim() !== '' || i18n.t('init:api.enterKey'),
        },
      ])
      apiUrl = apiAnswers.url?.trim() || ''
      apiKey = apiAnswers.key?.trim() || ''
    }
  }

  // ═══════════════════════════════════════════════════════
  // Step 2/4: Model Routing
  // ═══════════════════════════════════════════════════════
  if (!options.skipPrompt) {
    const existingConfig = await readCcgConfig()

    console.log()
    console.log(ansis.cyan.bold(`  🧠 Step 2/4 — ${i18n.t('init:model.title')}`))
    console.log()

    const { selectedFrontend } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedFrontend',
      message: i18n.t('init:model.selectFrontend'),
      choices: [
        { name: `Gemini ${ansis.green(`(${i18n.t('init:model.recommended')})`)}`, value: 'gemini' as ModelType },
        { name: 'Codex', value: 'codex' as ModelType },
      ],
      default: existingConfig?.routing?.frontend?.primary || 'gemini',
    }])

    const { selectedBackend } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedBackend',
      message: i18n.t('init:model.selectBackend'),
      choices: [
        { name: 'Gemini', value: 'gemini' as ModelType },
        { name: `Codex ${ansis.green(`(${i18n.t('init:model.recommended')})`)}`, value: 'codex' as ModelType },
      ],
      default: existingConfig?.routing?.backend?.primary || 'codex',
    }])

    frontendModels = [selectedFrontend]
    backendModels = [selectedBackend]

    // Ask for Gemini model name if Gemini is selected for any role
    if (selectedFrontend === 'gemini' || selectedBackend === 'gemini') {
      const { selectedGeminiModel } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedGeminiModel',
        message: i18n.t('init:model.selectGeminiModel'),
        choices: [
          { name: `gemini-3.1-pro-preview ${ansis.green(`(${i18n.t('init:model.recommended')})`)}`, value: 'gemini-3.1-pro-preview' },
          { name: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
          { name: `${i18n.t('init:model.custom')}`, value: 'custom' },
        ],
        default: existingConfig?.routing?.geminiModel || 'gemini-3.1-pro-preview',
      }])

      if (selectedGeminiModel === 'custom') {
        const { customModel } = await inquirer.prompt([{
          type: 'input',
          name: 'customModel',
          message: i18n.t('init:model.enterCustomModel'),
          validate: (v: string) => v.trim() !== '' || i18n.t('init:model.enterCustomModel'),
        }])
        geminiModel = customModel.trim()
      }
      else {
        geminiModel = selectedGeminiModel
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // Step 3/4: MCP Tools (checkbox multi-select)
  // ═══════════════════════════════════════════════════════
  if (options.skipMcp) {
    // Fix #124: preserve existing MCP provider from config during update
    // instead of unconditionally setting to 'skip'
    const existingConfig = await readCcgConfig()
    mcpProvider = existingConfig?.mcp?.provider || 'skip'
  }
  else if (!options.skipPrompt) {
    console.log()
    console.log(ansis.cyan.bold(`  🔧 Step 3/4 — ${i18n.t('init:mcp.title')}`))
    console.log()

    const { selectedTools } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedTools',
      message: i18n.t('init:mcp.selectTools'),
      choices: [
        {
          name: `ace-tool ${ansis.green(`(${i18n.t('common:info')})`)} ${ansis.gray('— search_context 代码检索')}`,
          value: 'ace-tool',
          checked: true,
        },
        {
          name: `fast-context ${ansis.gray('— AI 驱动语义搜索')}`,
          value: 'fast-context',
        },
        {
          name: `context7 ${ansis.green('(free)')} ${ansis.gray('— 库文档查询')}`,
          value: 'context7',
          checked: true,
        },
        {
          name: `grok-search ${ansis.gray('— 联网搜索 (需 API Key)')}`,
          value: 'grok-search',
        },
        {
          name: `contextweaver ${ansis.gray('— 硅基流动嵌入检索 (需 API Key)')}`,
          value: 'contextweaver',
        },
      ],
    }]) as { selectedTools: string[] }

    // Determine primary MCP provider for template variable replacement
    // Priority: ace-tool > fast-context > contextweaver > skip
    const hasAceTool = selectedTools.includes('ace-tool')
    const hasFastContext = selectedTools.includes('fast-context')
    const hasContextWeaver = selectedTools.includes('contextweaver')
    wantFastContext = hasFastContext
    wantGrokSearch = selectedTools.includes('grok-search')

    if (hasAceTool) {
      mcpProvider = 'ace-tool'
    }
    else if (hasFastContext) {
      mcpProvider = 'fast-context'
    }
    else if (hasContextWeaver) {
      mcpProvider = 'contextweaver'
    }
    else {
      mcpProvider = 'skip'
    }

    // ── Collect keys for selected tools that need them ──

    // ace-tool: needs Token
    if (hasAceTool) {
      console.log()
      console.log(ansis.cyan.bold(`  🔧 ace-tool MCP`))
      console.log()
      console.log(`     ${ansis.gray('•')} ${ansis.cyan(i18n.t('init:mcp.officialService'))}: ${ansis.underline('https://augmentcode.com/')}`)
      console.log(`     ${ansis.gray('•')} ${ansis.cyan(i18n.t('init:mcp.proxyService'))} ${ansis.yellow(`(${i18n.t('init:mcp.noSignup')})`)}: ${ansis.underline('https://acemcp.heroman.wtf/')}`)
      console.log()

      const aceAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'baseUrl',
          message: `Base URL ${ansis.gray(`(${i18n.t('init:mcp.baseUrlHint')})`)}`,
          default: '',
        },
        {
          type: 'password',
          name: 'token',
          message: `Token ${ansis.gray(`(${i18n.t('init:mcp.tokenRequired')})`)}`,
          mask: '*',
          validate: (input: string) => input.trim() !== '' || i18n.t('init:mcp.enterToken'),
        },
      ])
      aceToolBaseUrl = aceAnswers.baseUrl || ''
      aceToolToken = aceAnswers.token || ''
    }

    // fast-context: optional API Key
    if (hasFastContext) {
      console.log()
      console.log(ansis.cyan.bold(`  🔧 fast-context MCP`))
      console.log(ansis.gray(`     Windsurf Fast Context — ${i18n.t('init:mcp.fcAutoExtract')}`))
      console.log()

      const fcAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiKey',
          message: `WINDSURF_API_KEY ${ansis.gray(`(${i18n.t('init:mcp.fcLeaveEmpty')})`)}`,
          default: '',
        },
        {
          type: 'list',
          name: 'includeSnippets',
          message: i18n.t('init:mcp.fcSnippetMode'),
          choices: [
            { name: `${i18n.t('init:mcp.fcPathOnly')} ${ansis.gray(`(${i18n.t('init:mcp.fcSaveToken')})`)}`, value: false },
            { name: i18n.t('init:mcp.fcFullSnippet'), value: true },
          ],
        },
      ])
      fastContextApiKey = fcAnswers.apiKey?.trim() || ''
      fastContextIncludeSnippets = fcAnswers.includeSnippets
    }

    // contextweaver: needs SiliconFlow API Key
    if (hasContextWeaver) {
      console.log()
      console.log(ansis.cyan.bold(`  🔧 ContextWeaver MCP`))
      console.log()
      console.log(`     ${ansis.gray('1.')} ${i18n.t('init:mcp.siliconflowStep1', { url: ansis.underline('https://siliconflow.cn/') })}`)
      console.log(`     ${ansis.gray('2.')} ${i18n.t('init:mcp.siliconflowStep2')}`)
      console.log(`     ${ansis.gray('3.')} ${i18n.t('init:mcp.siliconflowStep3')}`)
      console.log()

      const cwAnswers = await inquirer.prompt([{
        type: 'password',
        name: 'apiKey',
        message: `SiliconFlow API Key ${ansis.gray('(sk-xxx)')}`,
        mask: '*',
        validate: (input: string) => input.trim() !== '' || i18n.t('init:mcp.enterApiKey'),
      }])
      contextWeaverApiKey = cwAnswers.apiKey || ''
    }

    // grok-search: needs API Keys
    if (wantGrokSearch) {
      console.log()
      console.log(ansis.cyan.bold(`  🔍 grok-search MCP`))
      console.log()
      console.log(`     Tavily: ${ansis.underline('https://www.tavily.com/')} ${ansis.gray(`(${i18n.t('init:grok.tavilyHint')})`)}`)
      console.log(`     Firecrawl: ${ansis.underline('https://www.firecrawl.dev/')} ${ansis.gray(`(${i18n.t('init:grok.firecrawlHint')})`)}`)
      console.log(`     Grok API: ${ansis.gray(i18n.t('init:grok.grokHint'))}`)
      console.log()

      const grokAnswers = await inquirer.prompt([
        { type: 'input', name: 'grokApiUrl', message: `GROK_API_URL ${ansis.gray(`(${i18n.t('init:grok.optional')})`)}`, default: '' },
        { type: 'password', name: 'grokApiKey', message: `GROK_API_KEY ${ansis.gray(`(${i18n.t('init:grok.optional')})`)}`, mask: '*' },
        { type: 'password', name: 'tavilyKey', message: `TAVILY_API_KEY ${ansis.gray(`(${i18n.t('init:grok.optional')})`)}`, mask: '*' },
        { type: 'password', name: 'firecrawlKey', message: `FIRECRAWL_API_KEY ${ansis.gray(`(${i18n.t('init:grok.optional')})`)}`, mask: '*' },
      ])

      tavilyKey = grokAnswers.tavilyKey?.trim() || ''
      firecrawlKey = grokAnswers.firecrawlKey?.trim() || ''
      grokApiUrl = grokAnswers.grokApiUrl?.trim() || ''
      grokApiKey = grokAnswers.grokApiKey?.trim() || ''
    }
  }

  // ═══════════════════════════════════════════════════════
  // Step 3/3: Performance Mode
  // ═══════════════════════════════════════════════════════
  if (!options.skipPrompt) {
    const existingConfig = await readCcgConfig()
    const currentLiteMode = existingConfig?.performance?.liteMode || false

    console.log()
    console.log(ansis.cyan.bold(`  ⚡ Step 4/4 — ${i18n.t('init:perf.title')}`))
    console.log()

    const { perfMode } = await inquirer.prompt([{
      type: 'list',
      name: 'perfMode',
      message: i18n.t('init:perf.selectMode'),
      choices: [
        { name: `${ansis.green('●')} ${i18n.t('init:perf.standardOption')}`, value: 'standard' },
        { name: `${ansis.cyan('●')} ${i18n.t('init:perf.liteOption')}`, value: 'lite' },
      ],
      default: currentLiteMode ? 'lite' : 'standard',
    }])

    liteMode = perfMode === 'lite'

    // Impeccable frontend design commands (optional, default: not installed)
    const { includeImpeccable } = await inquirer.prompt([{
      type: 'confirm',
      name: 'includeImpeccable',
      message: i18n.t('init:commands.includeImpeccable'),
      default: false,
    }])
    skipImpeccable = !includeImpeccable
  }
  else {
    // In non-interactive mode (update), preserve existing settings
    const existingConfig = await readCcgConfig()
    if (existingConfig?.performance?.liteMode !== undefined) {
      liteMode = existingConfig.performance.liteMode
    }
    if (existingConfig?.performance?.skipImpeccable !== undefined) {
      skipImpeccable = existingConfig.performance.skipImpeccable
    }
  }

  // Build routing config (user-selectable since v2.1.0)
  const routing: ModelRouting = {
    frontend: {
      models: frontendModels,
      primary: frontendModels[0],
      strategy: 'fallback',
    },
    backend: {
      models: backendModels,
      primary: backendModels[0],
      strategy: 'fallback',
    },
    review: {
      models: [...new Set([...frontendModels, ...backendModels])],
      strategy: 'parallel',
    },
    mode,
    geminiModel,
  }

  // Show summary
  console.log()
  console.log(ansis.yellow('━'.repeat(50)))
  console.log(ansis.bold(`  ${i18n.t('init:summary.title')}`))
  console.log()
  const fmName = frontendModels[0].charAt(0).toUpperCase() + frontendModels[0].slice(1)
  const bmName = backendModels[0].charAt(0).toUpperCase() + backendModels[0].slice(1)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.modelRouting'))}  ${ansis.green(fmName)} (Frontend) + ${ansis.blue(bmName)} (Backend)`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.commandCount'))}  ${ansis.yellow(selectedWorkflows.length.toString())}`)
  const mcpSummary = (() => {
    if (mcpProvider === 'fast-context') return ansis.green('fast-context')
    if (mcpProvider === 'ace-tool' || mcpProvider === 'ace-tool-rs') return aceToolToken ? ansis.green(mcpProvider) : ansis.yellow(`${mcpProvider} (${i18n.t('init:summary.pendingConfig')})`)
    if (mcpProvider === 'contextweaver') return contextWeaverApiKey ? ansis.green('contextweaver') : ansis.yellow(`contextweaver (${i18n.t('init:summary.pendingConfig')})`)
    return ansis.gray(i18n.t('init:summary.skipped'))
  })()
  console.log(`  ${ansis.cyan(i18n.t('init:summary.mcpTool'))}  ${mcpSummary}`)
  console.log(`  ${ansis.cyan(i18n.t('init:summary.webUI'))}    ${liteMode ? ansis.gray(i18n.t('init:summary.disabled')) : ansis.green(i18n.t('init:summary.enabled'))}`)
  if (wantGrokSearch) {
    console.log(`  ${ansis.cyan('grok-search')}    ${tavilyKey ? ansis.green('✓') : ansis.yellow(`(${i18n.t('init:summary.pendingConfig')})`)}`)
  }
  console.log(ansis.yellow('━'.repeat(50)))
  console.log()

  // Confirm in interactive mode (skip if force is true)
  if (!options.skipPrompt && !options.force) {
    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: i18n.t('init:confirmInstall'),
      default: true,
    }])

    if (!confirmed) {
      console.log(ansis.yellow(i18n.t('init:installCancelled')))
      return
    }
  }

  // Install
  const spinner = ora(i18n.t('init:installing')).start()

  try {
    // v1.4.0: Auto-migrate from old directory structure
    if (await needsMigration()) {
      spinner.text = 'Migrating from v1.3.x to v1.4.0...'
      const migrationResult = await migrateToV1_4_0()

      if (migrationResult.migratedFiles.length > 0) {
        spinner.info(ansis.cyan('Migration completed:'))
        console.log()
        for (const file of migrationResult.migratedFiles) {
          console.log(`  ${ansis.green('✓')} ${file}`)
        }
        if (migrationResult.skipped.length > 0) {
          console.log()
          console.log(ansis.gray('  Skipped:'))
          for (const file of migrationResult.skipped) {
            console.log(`  ${ansis.gray('○')} ${file}`)
          }
        }
        console.log()
        spinner.start(i18n.t('init:installing'))
      }

      if (migrationResult.errors.length > 0) {
        spinner.warn(ansis.yellow('Migration completed with errors:'))
        for (const error of migrationResult.errors) {
          console.log(`  ${ansis.red('✗')} ${error}`)
        }
        console.log()
        spinner.start(i18n.t('init:installing'))
      }
    }

    await ensureCcgDir()

    // Create config
    const config = createDefaultConfig({
      language,
      routing,
      installedWorkflows: selectedWorkflows,
      mcpProvider,
      liteMode,
      skipImpeccable,
    })

    // Save config FIRST - ensure it's created even if installation fails
    await writeCcgConfig(config)

    // Install workflows and commands
    const installDir = options.installDir || join(homedir(), '.claude')
    const result = await installWorkflows(selectedWorkflows, installDir, options.force, {
      routing,
      liteMode,
      mcpProvider,
      skipImpeccable,
    })

    // Install selected MCP tools (multiple can be installed)
    spinner.succeed(ansis.green(i18n.t('init:installSuccess')))

    // ace-tool
    if (aceToolToken) {
      spinner.text = i18n.t('init:aceTool.installing')
      const aceResult = await installAceTool({ baseUrl: aceToolBaseUrl, token: aceToolToken })
      if (aceResult.success) {
        console.log(`    ${ansis.green('✓')} ace-tool MCP ${ansis.gray(`→ ${aceResult.configPath}`)}`)
      }
      else {
        console.log(`    ${ansis.yellow('⚠')} ace-tool: ${ansis.gray(aceResult.message)}`)
      }
    }

    // fast-context
    if (wantFastContext) {
      const fcResult = await installFastContext({
        apiKey: fastContextApiKey || undefined,
        includeSnippets: fastContextIncludeSnippets,
      })
      if (fcResult.success) {
        console.log(`    ${ansis.green('✓')} fast-context MCP ${ansis.gray(`→ ${fcResult.configPath}`)}`)
        // Write search guidance — auxiliary mode if ace-tool is primary
        await writeFastContextPrompt(mcpProvider === 'ace-tool' || mcpProvider === 'ace-tool-rs')
        console.log(`    ${ansis.green('✓')} ${i18n.t('init:mcp.fcPromptInjected')} ${ansis.gray('→ ~/.claude/rules/ + ~/.codex/ + ~/.gemini/')}`)
      }
      else {
        console.log(`    ${ansis.yellow('⚠')} fast-context: ${ansis.gray(fcResult.message)}`)
      }
    }

    // contextweaver
    if (contextWeaverApiKey) {
      spinner.text = i18n.t('init:mcp.cwConfiguring')
      const cwResult = await installContextWeaver({ siliconflowApiKey: contextWeaverApiKey })
      if (cwResult.success) {
        console.log(`    ${ansis.green('✓')} ContextWeaver MCP ${ansis.gray(`→ ${cwResult.configPath}`)}`)
      }
      else {
        console.log(`    ${ansis.yellow('⚠')} ContextWeaver: ${ansis.gray(cwResult.message)}`)
      }
    }

    // ═══════════════════════════════════════════════════════
    // Save settings.json: API config + Hook auto-approve
    // ═══════════════════════════════════════════════════════
    const settingsPath = join(installDir, 'settings.json')

    // Save API configuration if provided
    if (apiUrl && apiKey) {
      let settings: Record<string, any> = {}
      if (await fs.pathExists(settingsPath)) {
        settings = await fs.readJSON(settingsPath)
      }
      if (!settings.env)
        settings.env = {}
      settings.env.ANTHROPIC_BASE_URL = apiUrl
      settings.env.ANTHROPIC_AUTH_TOKEN = apiKey
      delete settings.env.ANTHROPIC_API_KEY
      // Default optimization config
      settings.env.DISABLE_TELEMETRY = '1'
      settings.env.DISABLE_ERROR_REPORTING = '1'
      settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
      settings.env.CLAUDE_CODE_ATTRIBUTION_HEADER = '0'
      settings.env.MCP_TIMEOUT = '60000'
      // codeagent-wrapper permission allowlist
      if (!settings.permissions)
        settings.permissions = {}
      if (!settings.permissions.allow)
        settings.permissions.allow = []
      const wrapperPerms = [
        'Bash(~/.claude/bin/codeagent-wrapper --backend gemini*)',
        'Bash(~/.claude/bin/codeagent-wrapper --backend codex*)',
      ]
      for (const perm of wrapperPerms) {
        if (!settings.permissions.allow.includes(perm))
          settings.permissions.allow.push(perm)
      }
      await fs.writeJSON(settingsPath, settings, { spaces: 2 })
      console.log()
      console.log(`    ${ansis.green('✓')} API ${ansis.gray(`→ ${settingsPath}`)}`)
    }

    // Always install codeagent-wrapper auto-approve via permissions.allow
    await installHook(settingsPath)
    console.log()
    console.log(`    ${ansis.green('✓')} ${i18n.t('init:hooks.installed')} ${ansis.gray('(permissions.allow)')}`)

    // Install grok-search MCP if requested
    if (wantGrokSearch && (tavilyKey || firecrawlKey || grokApiUrl || grokApiKey)) {
      spinner.text = i18n.t('init:grok.installing')
      const grokResult = await installGrokSearchMcp({
        tavilyKey,
        firecrawlKey,
        grokApiUrl: grokApiUrl || undefined,
        grokApiKey: grokApiKey || undefined,
      })

      if (grokResult.success) {
        // Write global prompt to ~/.claude/rules/ccg-grok-search.md
        await appendGrokSearchPrompt()
        console.log()
        console.log(`    ${ansis.green('✓')} grok-search MCP ${ansis.gray('→ ~/.claude.json')}`)
        console.log(`    ${ansis.green('✓')} ${i18n.t('init:grok.promptAppended')} ${ansis.gray('→ ~/.claude/rules/ccg-grok-search.md')}`)
      }
      else {
        console.log()
        console.log(`    ${ansis.yellow('⚠')} grok-search MCP ${i18n.t('init:grok.installFailed')}`)
        console.log(ansis.gray(`      ${grokResult.message}`))
      }
    }

    // Install context7 MCP + Codex sync (skip when --skip-mcp is passed)
    if (!options.skipMcp) {
      const context7Result = await installMcpServer(
        'context7',
        'npx',
        ['-y', '@upstash/context7-mcp@latest'],
      )
      if (context7Result.success) {
        console.log()
        console.log(`    ${ansis.green('✓')} context7 MCP ${ansis.gray('→ ~/.claude.json')}`)
      }
      else {
        console.log()
        console.log(`    ${ansis.yellow('⚠')} context7 MCP install failed`)
        console.log(ansis.gray(`      ${context7Result.message}`))
      }

      // ═══════════════════════════════════════════════════════
      // Sync MCP servers to Codex (~/.codex/config.toml)
      // Enables /ccg:codex-exec to use MCP tools (grok-search, context7, etc.)
      // ═══════════════════════════════════════════════════════
      const codexSyncResult = await syncMcpToCodex()
      if (codexSyncResult.success && codexSyncResult.synced.length > 0) {
        console.log()
        console.log(`    ${ansis.green('✓')} Codex MCP sync: ${codexSyncResult.synced.join(', ')} ${ansis.gray('→ ~/.codex/config.toml')}`)
      }
      else if (!codexSyncResult.success) {
        console.log()
        console.log(`    ${ansis.yellow('⚠')} Codex MCP sync failed`)
        console.log(ansis.gray(`      ${codexSyncResult.message}`))
      }

      // ═══════════════════════════════════════════════════════
      // Sync MCP servers to Gemini (~/.gemini/settings.json)
      // ═══════════════════════════════════════════════════════
      const geminiSyncResult = await syncMcpToGemini()
      if (geminiSyncResult.success && geminiSyncResult.synced.length > 0) {
        console.log()
        console.log(`    ${ansis.green('✓')} Gemini MCP sync: ${geminiSyncResult.synced.join(', ')} ${ansis.gray('→ ~/.gemini/settings.json')}`)
      }
      else if (!geminiSyncResult.success) {
        console.log()
        console.log(`    ${ansis.yellow('⚠')} Gemini MCP sync failed`)
        console.log(ansis.gray(`      ${geminiSyncResult.message}`))
      }
    }

    // jq check removed — permissions.allow approach does not require jq

    // Show result summary
    console.log()
    console.log(ansis.cyan(`  ${i18n.t('init:installedCommands')}`))
    result.installedCommands.forEach((cmd) => {
      console.log(`    ${ansis.green('✓')} /ccg:${cmd}`)
    })

    // Show installed prompts
    if (result.installedPrompts.length > 0) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('init:installedPrompts')}`))
      // Group by model
      const grouped: Record<string, string[]> = {}
      result.installedPrompts.forEach((p) => {
        const [model, role] = p.split('/')
        if (!grouped[model])
          grouped[model] = []
        grouped[model].push(role)
      })
      Object.entries(grouped).forEach(([model, roles]) => {
        console.log(`    ${ansis.green('✓')} ${model}: ${roles.join(', ')}`)
      })
    }

    // Show installed skills
    if (result.installedSkills && result.installedSkills > 0) {
      console.log()
      console.log(ansis.cyan('  Skills:'))
      console.log(`    ${ansis.green('✓')} ${result.installedSkills} skills installed (quality gates + multi-agent)`)
      console.log(ansis.gray('       → ~/.claude/skills/'))
    }

    // Show installed rules
    if (result.installedRules) {
      console.log()
      console.log(ansis.cyan('  Rules:'))
      console.log(`    ${ansis.green('✓')} quality gate auto-trigger rules`)
      console.log(ansis.gray('       → ~/.claude/rules/ccg-skills.md'))
    }

    // Show errors if any
    if (result.errors.length > 0) {
      console.log()
      if (!result.success) {
        // Critical failure — prominent red box
        console.log(ansis.red.bold(`  ╔════════════════════════════════════════════════════════════╗`))
        console.log(ansis.red.bold(`  ║  ⚠  安装出现错误 / Installation errors detected           ║`))
        console.log(ansis.red.bold(`  ╚════════════════════════════════════════════════════════════╝`))
      }
      else {
        console.log(ansis.yellow(`  ⚠ ${i18n.t('init:installationErrors')}`))
      }
      result.errors.forEach((error) => {
        console.log(`    ${ansis.red('✗')} ${error}`)
      })
      if (!result.success) {
        console.log()
        console.log(ansis.yellow(`  尝试修复 / Try to fix:`))
        console.log(ansis.cyan(`    npx ccg-workflow@latest init --force`))
        console.log(ansis.gray(`    如仍失败，请提交 issue 并附上以上错误信息`))
        console.log(ansis.gray(`    If still failing, report an issue with the errors above`))
      }
    }

    // Show binary installation result
    if (result.binInstalled && result.binPath) {
      console.log()
      console.log(ansis.cyan(`  ${i18n.t('init:installedBinary')}`))
      console.log(`    ${ansis.green('✓')} codeagent-wrapper ${ansis.gray(`→ ${result.binPath}`)}`)

      const platform = process.platform

      if (platform === 'win32') {
        const windowsPath = result.binPath.replace(/\//g, '\\').replace(/\\$/, '')
        try {
          const { execSync } = await import('node:child_process')
          const psFlags = '-NoProfile -NonInteractive -ExecutionPolicy Bypass'
          const currentPath = execSync(`powershell ${psFlags} -Command "[System.Environment]::GetEnvironmentVariable('PATH', 'User')"`, { encoding: 'utf-8' }).trim()
          const currentPathNorm = currentPath.toLowerCase().replace(/\\$/g, '')
          const windowsPathNorm = windowsPath.toLowerCase()

          if (!currentPathNorm.includes(windowsPathNorm) && !currentPathNorm.includes('.claude\\bin')) {
            const escapedPath = windowsPath.replace(/'/g, "''")
            const psScript = currentPath
              ? `$p=[System.Environment]::GetEnvironmentVariable('PATH','User');[System.Environment]::SetEnvironmentVariable('PATH',($p+';'+'${escapedPath}'),'User')`
              : `[System.Environment]::SetEnvironmentVariable('PATH','${escapedPath}','User')`
            execSync(`powershell ${psFlags} -Command "${psScript}"`, { stdio: 'pipe' })
            console.log(`    ${ansis.green('✓')} PATH ${ansis.gray('→ User env')}`)
          }
        }
        catch {
          // Silently ignore PATH config errors on Windows
        }
      }
      else if (!options.skipPrompt) {
        const exportCommand = `export PATH="${result.binPath}:$PATH"`
        const shell = process.env.SHELL || ''
        const isZsh = shell.includes('zsh')
        const isBash = shell.includes('bash')
        const isMacDefaultZsh = process.platform === 'darwin' && !shell

        if (isZsh || isBash || isMacDefaultZsh) {
          const shellRc = (isZsh || isMacDefaultZsh) ? join(homedir(), '.zshrc') : join(homedir(), '.bashrc')
          const shellRcDisplay = (isZsh || isMacDefaultZsh) ? '~/.zshrc' : '~/.bashrc'

          try {
            let rcContent = ''
            if (await fs.pathExists(shellRc)) {
              rcContent = await fs.readFile(shellRc, 'utf-8')
            }

            if (rcContent.includes(result.binPath) || rcContent.includes('/.claude/bin')) {
              console.log(`    ${ansis.green('✓')} PATH ${ansis.gray(`→ ${shellRcDisplay} (${i18n.t('init:pathAlreadyConfigured', { file: shellRcDisplay })})`)}`)
            }
            else {
              const configLine = `\n# CCG multi-model collaboration system\n${exportCommand}\n`
              await fs.appendFile(shellRc, configLine, 'utf-8')
              console.log(`    ${ansis.green('✓')} PATH ${ansis.gray(`→ ${shellRcDisplay}`)}`)
            }
          }
          catch {
            // Silently ignore PATH config errors
          }
        }
        else {
          console.log(`    ${ansis.yellow('⚠')} PATH ${ansis.gray(`→ ${i18n.t('init:addToPathManually')}`)}`)
          console.log(`      ${ansis.cyan(exportCommand)}`)
        }
      }
    }
    else {
      // Binary download failed — show prominent warning with manual fix instructions
      showBinaryDownloadWarning(join(installDir, 'bin'))
    }

    // Show MCP resources if user skipped installation
    if (mcpProvider === 'skip' || ((mcpProvider === 'ace-tool' || mcpProvider === 'ace-tool-rs') && !aceToolToken) || (mcpProvider === 'contextweaver' && !contextWeaverApiKey)) {
      console.log()
      console.log(ansis.cyan.bold(`  📖 ${i18n.t('init:mcp.mcpOptions')}`))
      console.log()
      console.log(ansis.gray(`     ${i18n.t('init:mcp.mcpOptionsHint')}`))
      console.log()
      console.log(`     ${ansis.green('1.')} ${ansis.cyan('fast-context')} ${ansis.yellow('(推荐)')}: Windsurf Fast Context`)
      console.log(`        ${ansis.gray('AI 驱动代码搜索，需 Windsurf 账号，免费/低成本')}`)
      console.log()
      console.log(`     ${ansis.green('2.')} ${ansis.cyan('ace-tool / ace-tool-rs')}: ${ansis.underline('https://augmentcode.com/')}`)
      console.log(`        ${ansis.gray(i18n.t('init:mcp.promptEnhancement'))}`)
      console.log()
      console.log(`     ${ansis.green('3.')} ${ansis.cyan('ace-tool ' + i18n.t('init:mcp.proxyService'))} ${ansis.yellow(`(${i18n.t('init:mcp.noSignup')})`)}: ${ansis.underline('https://acemcp.heroman.wtf/')}`)
      console.log(`        ${ansis.gray(i18n.t('init:mcp.communityProxy'))}`)
      console.log()
      console.log(`     ${ansis.green('4.')} ${ansis.cyan('ContextWeaver')} ${ansis.yellow(`(${i18n.t('init:mcp.freeQuota')})`)}: ${ansis.underline('https://siliconflow.cn/')}`)
      console.log(`        ${ansis.gray(i18n.t('init:mcp.localEngine'))}`)
      console.log()
    }

    console.log()
  }
  catch (error) {
    spinner.fail(ansis.red(i18n.t('init:installFailed')))
    console.error(error)
  }
}
