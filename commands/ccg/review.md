---
description: 多模型代码审查（根据配置并行），无参数时自动审查 git diff
---

## Usage
`/review [CODE_OR_DESCRIPTION]`

## Context
- Arguments: $ARGUMENTS
- This command triggers multi-model code review based on your configuration.
- Configured models review simultaneously for comprehensive feedback.

## Configuration
**首先读取 `~/.ccg/config.toml` 获取审查模型配置**:
```toml
[routing.review]
models = ["codex", "gemini"]  # 用户配置的审查模型列表
strategy = "parallel"          # 始终并行执行
```

## Behavior
- **No arguments**: Automatically review current git changes (staged + unstaged)
- **With arguments**: Review specified code or description

## Your Role
You are the **Code Review Coordinator** orchestrating multi-model review. You direct:
1. **ace-tool** – for retrieving code context
2. **Configured Review Models** – for comprehensive code review
3. **Claude (Self)** – for synthesizing feedback and recommendations

## Process

### Step 1: Read Configuration + Get Code to Review

1. **读取 `~/.ccg/config.toml`** 获取 `routing.review.models`
2. 如果配置不存在，默认使用 `["codex", "gemini"]`

**If no arguments provided**, run git commands to get current changes:
```bash
# Get staged and unstaged changes
git diff HEAD
git status --short
```

**If arguments provided**, use the specified code/description.

Then **调用代码检索工具**获取相关上下文:
- 读取 `~/.ccg/config.toml` 获取 `[mcp] provider`
- 使用 `[mcp.tools] code_search_{provider}` 配置的工具名称
- 参数：`project_root_path`，查询参数名使用 `query_param_{provider}` 的值

### Step 2: Parallel Review

**并行调用所有配置的审查模型**（使用 `run_in_background: true` 非阻塞执行）：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

遍历 `routing.review.models`，为每个模型发送调用：

```bash
# 示例：调用配置的审查模型
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/reviewer.md 的内容并注入
</ROLE>

<TASK>
Code changes to review:
<git_diff_or_specified_code>
</TASK>

OUTPUT: Review comments only. No code modifications.
EOF
```

### Step 3: Synthesize Feedback
使用 `TaskOutput` 获取所有任务的结果，然后：
1. Collect feedback from all configured models
2. Categorize by severity (Critical, Major, Minor, Suggestion)
3. Remove duplicate concerns
4. Cross-validate findings across models
5. Prioritize actionable items

### Step 4: Present Review
Provide unified review report to user with recommendations.

## Output Format
1. **Configuration** – models used for review
2. **Review Summary** – overall assessment
3. **Critical Issues** – must fix before merge
4. **Major Issues** – should fix
5. **Minor Issues** – nice to fix
6. **Suggestions** – optional improvements
7. **Recommended Actions** – prioritized fix list

## Notes
- **首先读取 `~/.ccg/config.toml` 获取审查模型配置**
- **No arguments** = auto-review git changes (`git diff HEAD`)
- **With arguments** = review specified content
- **Use `run_in_background: true` for parallel execution** to avoid blocking
- 多模型结果交叉验证，综合反馈
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
