---
description: 双模型代码审查（Codex + Gemini 并行），无参数时自动审查 git diff
---

## Usage
`/review [CODE_OR_DESCRIPTION]`

## Context
- Arguments: $ARGUMENTS
- This command triggers dual-model code review (Codex + Gemini).
- Both models review simultaneously for comprehensive feedback.

## Behavior
- **No arguments**: Automatically review current git changes (staged + unstaged)
- **With arguments**: Review specified code or description

## Your Role
You are the **Code Review Coordinator** orchestrating multi-model review. You direct:
1. **Auggie** – for retrieving code context
2. **Codex** – for logic, security, and performance review
3. **Gemini** – for UI/UX, accessibility, and design review
4. **Claude (Self)** – for synthesizing feedback and recommendations

## Process

### Step 1: Get Code to Review

**If no arguments provided**, run git commands to get current changes:
```bash
# Get staged and unstaged changes
git diff HEAD
git status --short
```

**If arguments provided**, use the specified code/description.

Then call `mcp__auggie-mcp__codebase-retrieval` to get related context.

### Step 2: Parallel Review

**并行调用 Codex 和 Gemini**（使用 `run_in_background: true` 非阻塞执行）：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

在单个消息中同时发送两个 Bash 工具调用：

```bash
# Codex 审查
codeagent-wrapper --backend codex - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/codex/reviewer.md 的内容并注入
</ROLE>

<TASK>
Code changes to review:
<git_diff_or_specified_code>
</TASK>

OUTPUT: Review comments only. No code modifications.
EOF
```

```bash
# Gemini 审查
codeagent-wrapper --backend gemini - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/gemini/reviewer.md 的内容并注入
</ROLE>

<TASK>
Code changes to review:
<git_diff_or_specified_code>
</TASK>

OUTPUT: Review comments only. No code modifications.
EOF
```

### Step 3: Synthesize Feedback
使用 `TaskOutput` 获取两个任务的结果，然后：
1. Collect feedback from both models
2. Categorize by severity (Critical, Major, Minor, Suggestion)
3. Remove duplicate concerns
4. Prioritize actionable items

### Step 4: Present Review
Provide unified review report to user with recommendations.

## Output Format
1. **Review Summary** – overall assessment
2. **Critical Issues** – must fix before merge
3. **Major Issues** – should fix
4. **Minor Issues** – nice to fix
5. **Suggestions** – optional improvements
6. **Recommended Actions** – prioritized fix list

## Notes
- **No arguments** = auto-review git changes (`git diff HEAD`)
- **With arguments** = review specified content
- **Use `run_in_background: true` for parallel execution** to avoid blocking
- Codex focuses on backend/logic concerns
- Gemini focuses on frontend/UI concerns
- Synthesize overlapping feedback
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
