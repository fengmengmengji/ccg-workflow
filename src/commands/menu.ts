import ansis from 'ansis'
import inquirer from 'inquirer'
import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir } from 'node:os'
import { join } from 'pathe'
import fs from 'fs-extra'
import { configMcp } from './config-mcp'
import { i18n } from '../i18n'
import { uninstallWorkflows } from '../utils/installer'
import { init } from './init'
import { update } from './update'
import { isWindows } from '../utils/platform'

const execAsync = promisify(exec)

export async function showMainMenu(): Promise<void> {
  while (true) {
    console.log()
    console.log(ansis.cyan.bold(`  CCG - Claude + Codex + Gemini`))
    console.log(ansis.gray('  Multi-Model Collaboration System'))
    console.log()

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: i18n.t('menu:title'),
      choices: [
        { name: `${ansis.green('➜')} ${i18n.t('menu:options.init')}`, value: 'init' },
        { name: `${ansis.blue('➜')} ${i18n.t('menu:options.update')}`, value: 'update' },
        { name: `${ansis.cyan('⚙')} 配置 MCP`, value: 'config-mcp' },
        { name: `${ansis.cyan('🔑')} 配置 API`, value: 'config-api' },
        { name: `${ansis.yellow('🔧')} 实用工具`, value: 'tools' },
        { name: `${ansis.blue('📦')} 安装 Claude Code`, value: 'install-claude' },
        { name: `${ansis.magenta('➜')} ${i18n.t('menu:options.uninstall')}`, value: 'uninstall' },
        { name: `${ansis.yellow('?')} ${i18n.t('menu:options.help')}`, value: 'help' },
        new inquirer.Separator(),
        { name: `${ansis.red('✕')} ${i18n.t('menu:options.exit')}`, value: 'exit' },
      ],
    }])

    switch (action) {
      case 'init':
        await init()
        break
      case 'update':
        await update()
        break
      case 'config-mcp':
        await configMcp()
        break
      case 'config-api':
        await configApi()
        break
      case 'tools':
        await handleTools()
        break
      case 'install-claude':
        await handleInstallClaude()
        break
      case 'uninstall':
        await uninstall()
        break
      case 'help':
        showHelp()
        break
      case 'exit':
        console.log(ansis.gray('再见！'))
        return // 退出循环和函数
    }

    // 操作完成后暂停，让用户看到结果
    console.log()
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: ansis.gray('按 Enter 返回主菜单...'),
    }])
  }
}

function showHelp(): void {
  console.log()
  console.log(ansis.cyan.bold(i18n.t('menu:help.title')))
  console.log()

  // Development Workflows
  console.log(ansis.yellow.bold('  开发工作流:'))
  console.log(`  ${ansis.green('/ccg:workflow')}    完整6阶段开发工作流`)
  console.log(`  ${ansis.green('/ccg:plan')}        多模型协作规划（Phase 1-2）`)
  console.log(`  ${ansis.green('/ccg:execute')}     多模型协作执行（Phase 3-5）`)
  console.log(`  ${ansis.green('/ccg:frontend')}    ${i18n.t('menu:help.descriptions.frontend')}`)
  console.log(`  ${ansis.green('/ccg:backend')}     ${i18n.t('menu:help.descriptions.backend')}`)
  console.log(`  ${ansis.green('/ccg:feat')}        智能功能开发`)
  console.log(`  ${ansis.green('/ccg:analyze')}     ${i18n.t('menu:help.descriptions.analyze')}`)
  console.log(`  ${ansis.green('/ccg:debug')}       问题诊断 + 修复`)
  console.log(`  ${ansis.green('/ccg:optimize')}    性能优化`)
  console.log(`  ${ansis.green('/ccg:test')}        测试生成`)
  console.log(`  ${ansis.green('/ccg:review')}      ${i18n.t('menu:help.descriptions.review')}`)
  console.log()

  // OpenSpec Workflows
  console.log(ansis.yellow.bold('  OpenSpec 规范驱动:'))
  console.log(`  ${ansis.green('/ccg:spec-init')}      初始化 OpenSpec 环境`)
  console.log(`  ${ansis.green('/ccg:spec-research')} 需求研究 → 约束集`)
  console.log(`  ${ansis.green('/ccg:spec-plan')}     多模型分析 → 零决策计划`)
  console.log(`  ${ansis.green('/ccg:spec-impl')}     规范驱动实现`)
  console.log(`  ${ansis.green('/ccg:spec-review')}   归档前双模型审查`)
  console.log()

  // Git Tools
  console.log(ansis.yellow.bold('  Git 工具:'))
  console.log(`  ${ansis.green('/ccg:commit')}      ${i18n.t('menu:help.descriptions.commit')}`)
  console.log(`  ${ansis.green('/ccg:rollback')}    ${i18n.t('menu:help.descriptions.rollback')}`)
  console.log(`  ${ansis.green('/ccg:clean-branches')} 清理已合并分支`)
  console.log(`  ${ansis.green('/ccg:worktree')}    Git Worktree 管理`)
  console.log()

  // Project Init
  console.log(ansis.yellow.bold('  项目管理:'))
  console.log(`  ${ansis.green('/ccg:init')}        初始化项目 CLAUDE.md`)
  console.log()

  console.log(ansis.gray(i18n.t('menu:help.hint')))
  console.log()
}

// ============ API 配置 ============

async function configApi(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold('  配置 Claude Code API'))
  console.log()

  const settingsPath = join(homedir(), '.claude', 'settings.json')
  let settings: Record<string, any> = {}

  if (await fs.pathExists(settingsPath)) {
    settings = await fs.readJson(settingsPath)
  }

  // Show current config
  const currentUrl = settings.env?.ANTHROPIC_BASE_URL
  const currentKey = settings.env?.ANTHROPIC_API_KEY || settings.env?.ANTHROPIC_AUTH_TOKEN
  if (currentUrl || currentKey) {
    console.log(ansis.gray('  当前配置:'))
    if (currentUrl)
      console.log(ansis.gray(`    URL: ${currentUrl}`))
    if (currentKey)
      console.log(ansis.gray(`    Key: ${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`))
    console.log()
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: `API URL ${ansis.gray('(留空使用官方)')}`,
      default: currentUrl || '',
    },
    {
      type: 'password',
      name: 'key',
      message: `API Key ${ansis.gray('(留空跳过)')}`,
      mask: '*',
    },
  ])

  if (!answers.url && !answers.key) {
    console.log(ansis.gray('未修改配置'))
    return
  }

  // Update settings
  if (!settings.env)
    settings.env = {}

  if (answers.url?.trim()) {
    settings.env.ANTHROPIC_BASE_URL = answers.url.trim()
  }

  if (answers.key?.trim()) {
    settings.env.ANTHROPIC_API_KEY = answers.key.trim()
    delete settings.env.ANTHROPIC_AUTH_TOKEN
  }

  // 默认优化配置
  settings.env.DISABLE_TELEMETRY = '1'
  settings.env.DISABLE_ERROR_REPORTING = '1'
  settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '1'
  settings.env.CLAUDE_CODE_ATTRIBUTION_HEADER = '0'
  settings.env.MCP_TIMEOUT = '60000'

  // codeagent-wrapper 权限白名单
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

  await fs.ensureDir(join(homedir(), '.claude'))
  await fs.writeJson(settingsPath, settings, { spaces: 2 })

  console.log()
  console.log(ansis.green('✓ API 配置已保存'))
  console.log(ansis.gray(`  配置文件: ${settingsPath}`))
}

// ============ 安装 Claude Code ============

async function handleInstallClaude(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold('  安装/重装 Claude Code'))
  console.log()

  // 检查是否已安装
  let isInstalled = false
  try {
    await execAsync('claude --version', { timeout: 5000 })
    isInstalled = true
  }
  catch {
    isInstalled = false
  }

  if (isInstalled) {
    console.log(ansis.yellow('⚠ 检测到已安装 Claude Code'))
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: '是否卸载后重新安装？',
      default: false,
    }])

    if (!confirm) {
      console.log(ansis.gray('已取消'))
      return
    }

    // 卸载
    console.log()
    console.log(ansis.yellow('⏳ 正在卸载 Claude Code...'))
    try {
      const uninstallCmd = isWindows() ? 'npm uninstall -g @anthropic-ai/claude-code' : 'sudo npm uninstall -g @anthropic-ai/claude-code'
      await execAsync(uninstallCmd, { timeout: 60000 })
      console.log(ansis.green('✓ 卸载成功'))
    }
    catch (e) {
      console.log(ansis.red(`✗ 卸载失败: ${e}`))
      return
    }
  }

  // 选择安装方式
  const isMac = process.platform === 'darwin'
  const isLinux = process.platform === 'linux'

  const { method } = await inquirer.prompt([{
    type: 'list',
    name: 'method',
    message: '选择安装方式',
    choices: [
      { name: `npm ${ansis.green('(推荐)')} ${ansis.gray('- 全局安装')}`, value: 'npm' },
      ...((isMac || isLinux) ? [{ name: `homebrew ${ansis.gray('- brew install')}`, value: 'homebrew' }] : []),
      ...((isMac || isLinux) ? [{ name: `curl ${ansis.gray('- 官方脚本')}`, value: 'curl' }] : []),
      ...(isWindows() ? [
        { name: `powershell ${ansis.gray('- Windows 官方')}`, value: 'powershell' },
        { name: `cmd ${ansis.gray('- 命令提示符')}`, value: 'cmd' },
      ] : []),
      new inquirer.Separator(),
      { name: `${ansis.gray('取消')}`, value: 'cancel' },
    ],
  }])

  if (method === 'cancel')
    return

  console.log()
  console.log(ansis.yellow('⏳ 正在安装 Claude Code...'))

  try {
    if (method === 'npm') {
      const installCmd = isWindows() ? 'npm install -g @anthropic-ai/claude-code' : 'sudo npm install -g @anthropic-ai/claude-code'
      await execAsync(installCmd, { timeout: 300000 })
    }
    else if (method === 'homebrew') {
      await execAsync('brew install --cask claude-code', { timeout: 300000 })
    }
    else if (method === 'curl') {
      await execAsync('curl -fsSL https://claude.ai/install.sh | bash', { timeout: 300000 })
    }
    else if (method === 'powershell') {
      await execAsync('powershell -Command "irm https://claude.ai/install.ps1 | iex"', { timeout: 300000 })
    }
    else if (method === 'cmd') {
      await execAsync('cmd /c "curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd"', { timeout: 300000 })
    }

    console.log(ansis.green('✓ Claude Code 安装成功'))
    console.log()
    console.log(ansis.cyan('💡 提示：运行 claude 命令启动'))
  }
  catch (e) {
    console.log(ansis.red(`✗ 安装失败: ${e}`))
  }
}

/**
 * Check if CCG is installed globally via npm
 */
async function checkIfGlobalInstall(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('npm list -g ccg-workflow --depth=0', { timeout: 5000 })
    return stdout.includes('ccg-workflow@')
  }
  catch {
    return false
  }
}

async function uninstall(): Promise<void> {
  console.log()

  // Check if installed globally via npm
  const isGlobalInstall = await checkIfGlobalInstall()

  if (isGlobalInstall) {
    console.log(ansis.yellow('⚠️  检测到你是通过 npm 全局安装的'))
    console.log()
    console.log('完整卸载需要两步：')
    console.log(`  ${ansis.cyan('1. 移除工作流文件')} (即将执行)`)
    console.log(`  ${ansis.cyan('2. 卸载 npm 全局包')} (需要手动执行)`)
    console.log()
  }

  // Confirm uninstall
  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: isGlobalInstall ? '继续卸载工作流文件？' : i18n.t('menu:uninstall.confirm'),
    default: false,
  }])

  if (!confirm) {
    console.log(ansis.gray(i18n.t('menu:uninstall.cancelled')))
    return
  }

  console.log()
  console.log(ansis.yellow(i18n.t('menu:uninstall.uninstalling')))

  // Uninstall workflows
  const installDir = join(homedir(), '.claude')
  const result = await uninstallWorkflows(installDir)

  if (result.success) {
    console.log(ansis.green('✅ 工作流文件已移除'))

    if (result.removedCommands.length > 0) {
      console.log()
      console.log(ansis.cyan(i18n.t('menu:uninstall.removedCommands')))
      for (const cmd of result.removedCommands) {
        console.log(`  ${ansis.gray('•')} /ccg:${cmd}`)
      }
    }

    if (result.removedAgents.length > 0) {
      console.log()
      console.log(ansis.cyan('已移除子智能体:'))
      for (const agent of result.removedAgents) {
        console.log(`  ${ansis.gray('•')} ${agent}`)
      }
    }

    if (result.removedSkills.length > 0) {
      console.log()
      console.log(ansis.cyan('已移除 Skills:'))
      console.log(`  ${ansis.gray('•')} multi-model-collaboration`)
    }

    if (result.removedBin) {
      console.log()
      console.log(ansis.cyan('已移除二进制文件:'))
      console.log(`  ${ansis.gray('•')} codeagent-wrapper`)
    }

    // If globally installed, show instructions to uninstall npm package
    if (isGlobalInstall) {
      console.log()
      console.log(ansis.yellow.bold('🔸 最后一步：卸载 npm 全局包'))
      console.log()
      console.log('请在新的终端窗口中运行：')
      console.log()
      console.log(ansis.cyan.bold('  npm uninstall -g ccg-workflow'))
      console.log()
      console.log(ansis.gray('(完成后 ccg 命令将彻底移除)'))
    }
  }
  else {
    console.log(ansis.red(i18n.t('menu:uninstall.failed')))
    for (const error of result.errors) {
      console.log(ansis.red(`  ${error}`))
    }
  }

  console.log()
}

// ============ 实用工具 ============

async function handleTools(): Promise<void> {
  console.log()

  const { tool } = await inquirer.prompt([{
    type: 'list',
    name: 'tool',
    message: '选择工具',
    choices: [
      { name: `${ansis.green('📊')} ccusage ${ansis.gray('- Claude Code 用量分析')}`, value: 'ccusage' },
      { name: `${ansis.blue('📟')} CCometixLine ${ansis.gray('- 状态栏工具（Git + 用量）')}`, value: 'ccline' },
      new inquirer.Separator(),
      { name: `${ansis.gray('返回')}`, value: 'cancel' },
    ],
  }])

  if (tool === 'cancel')
    return

  if (tool === 'ccusage') {
    await runCcusage()
  }
  else if (tool === 'ccline') {
    await handleCCometixLine()
  }
}

async function runCcusage(): Promise<void> {
  console.log()
  console.log(ansis.cyan('📊 运行 ccusage...'))
  console.log(ansis.gray('$ npx ccusage@latest'))
  console.log()

  return new Promise((resolve) => {
    const child = spawn('npx', ['ccusage@latest'], {
      stdio: 'inherit',
      shell: true,
    })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
}

async function handleCCometixLine(): Promise<void> {
  console.log()

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'CCometixLine 操作',
    choices: [
      { name: `${ansis.green('➜')} 安装/更新`, value: 'install' },
      { name: `${ansis.red('✕')} 卸载`, value: 'uninstall' },
      new inquirer.Separator(),
      { name: `${ansis.gray('返回')}`, value: 'cancel' },
    ],
  }])

  if (action === 'cancel')
    return

  if (action === 'install') {
    await installCCometixLine()
  }
  else if (action === 'uninstall') {
    await uninstallCCometixLine()
  }
}

async function installCCometixLine(): Promise<void> {
  console.log()
  console.log(ansis.yellow('⏳ 正在安装 CCometixLine...'))

  try {
    // 1. Install npm package globally
    const installCmd = isWindows() ? 'npm install -g @cometix/ccline' : 'sudo npm install -g @cometix/ccline'
    await execAsync(installCmd, { timeout: 120000 })
    console.log(ansis.green('✓ @cometix/ccline 安装成功'))

    // 2. Configure Claude Code statusLine
    const settingsPath = join(homedir(), '.claude', 'settings.json')
    let settings: Record<string, any> = {}

    if (await fs.pathExists(settingsPath)) {
      settings = await fs.readJson(settingsPath)
    }

    settings.statusLine = {
      type: 'command',
      command: isWindows()
        ? '%USERPROFILE%\\.claude\\ccline\\ccline.exe'
        : '~/.claude/ccline/ccline',
      padding: 0,
    }

    await fs.ensureDir(join(homedir(), '.claude'))
    await fs.writeJson(settingsPath, settings, { spaces: 2 })
    console.log(ansis.green('✓ Claude Code statusLine 已配置'))

    console.log()
    console.log(ansis.cyan('💡 提示：重启 Claude Code CLI 使配置生效'))
  }
  catch (error) {
    console.log(ansis.red(`✗ 安装失败: ${error}`))
  }
}

async function uninstallCCometixLine(): Promise<void> {
  console.log()
  console.log(ansis.yellow('⏳ 正在卸载 CCometixLine...'))

  try {
    // 1. Remove statusLine config
    const settingsPath = join(homedir(), '.claude', 'settings.json')
    if (await fs.pathExists(settingsPath)) {
      const settings = await fs.readJson(settingsPath)
      delete settings.statusLine
      await fs.writeJson(settingsPath, settings, { spaces: 2 })
      console.log(ansis.green('✓ statusLine 配置已移除'))
    }

    // 2. Uninstall npm package
    const uninstallCmd = isWindows() ? 'npm uninstall -g @cometix/ccline' : 'sudo npm uninstall -g @cometix/ccline'
    await execAsync(uninstallCmd, { timeout: 60000 })
    console.log(ansis.green('✓ @cometix/ccline 已卸载'))
  }
  catch (error) {
    console.log(ansis.red(`✗ 卸载失败: ${error}`))
  }
}
