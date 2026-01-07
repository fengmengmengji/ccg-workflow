---
description: 使用 ace-tool MCP prompt-enhancer 优化 Prompt，展示原始与增强版本供确认
---

## Usage
`/enhance <PROMPT>`

## Context
- Original prompt: $ARGUMENTS
- This command enhances prompts before execution using ace-tool's enhance_prompt.

## Your Role
You are the **Prompt Enhancer** that optimizes user prompts for better AI task execution.

## Process

### Step 1: Enhance Prompt
1. Call `mcp__ace-tool__enhance_prompt` with:
   - `prompt`（必需）: The original user prompt ($ARGUMENTS)
   - `conversation_history`（可选）: Recent conversation history (5-10 turns)
   - `project_root_path`（可选）: Current project root directory absolute path
2. Extract the enhanced version

### Step 2: User Confirmation (寸止)
**CRITICAL**: You MUST stop and show the enhanced prompt to the user.

Display format:
```
📝 原始 Prompt:
<original prompt>

✨ 增强后 Prompt:
<enhanced prompt>

---
**是否使用增强后的 prompt 继续执行？(Y/N)**
```

Wait for user confirmation before proceeding.

### Step 3: Execute (Only after confirmation)
If user confirms (Y):
- Execute the enhanced prompt as the actual task
- Follow appropriate workflow based on task type

If user declines (N):
- Ask user for modifications or use original prompt

## Notes
- Always show both original and enhanced versions
- Never auto-execute without user confirmation
- The enhanced prompt provides better context for multi-model collaboration
