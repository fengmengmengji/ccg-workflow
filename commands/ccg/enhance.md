---
description: 使用 ace-tool enhance_prompt 优化 Prompt，展示原始与增强版本供确认
---

## Usage
`/enhance <PROMPT>`

## Context
- Original prompt: $ARGUMENTS
- This command enhances prompts before execution using ace-tool's enhance_prompt.

## Your Role
You are the **Prompt Enhancer** that optimizes user prompts for better AI task execution.

## Process

### Step 1: 读取 MCP 配置并调用 Prompt 增强工具
1. 读取 `~/.ccg/config.toml`:
   - 获取 `[mcp] provider`（如 "ace-tool" 或 "auggie"）
   - 获取 `[mcp.tools] prompt_enhance_{provider}` 的工具名称
2. 如果工具名不为空，调用该工具：
   - 参数：`project_root_path`, `prompt`, `conversation_history`
3. 如果工具名为空字符串（如 auggie 不支持），提示用户：
   - 显示配置中 `[mcp.{provider}] setup_url` 的链接
   - 建议手动优化 prompt 或切换到 ace-tool

### Step 2: 处理响应
根据工具返回的结果：
- **增强后的 prompt**: 使用该 prompt 继续执行任务
- **原始 prompt**: 使用原始 prompt 继续
- **`__END_CONVERSATION__`**: 停止对话，不执行任何任务
- **工具不可用**: 直接使用原始 prompt

### Step 3: 执行任务
根据用户选择或配置限制执行相应操作。

## Notes
- 支持自动语言检测（中文输入 → 中文输出）
- 8 分钟超时后自动回退到原始 prompt（仅部分 MCP 支持）
- 也可通过在消息末尾添加 `-enhance` 或 `-Enhancer` 触发
- 详细的 MCP 功能对比见配置文件 `~/.ccg/config.toml`
