---
description: 多模型技术分析（根据配置并行），交叉验证后综合见解
---

## Usage
`/analyze <QUESTION_OR_TASK>`

## Context
- Question or analysis task: $ARGUMENTS
- This command triggers multi-model analysis without code changes.
- Configured models provide perspectives for cross-validation.

## Configuration
**首先读取 `~/.ccg/config.toml` 获取模型配置**:
```toml
[routing.frontend]
models = ["gemini", "codex"]

[routing.backend]
models = ["codex", "gemini"]
```

分析任务使用 `routing.frontend.models` 和 `routing.backend.models` 的并集。

## Your Role
You are the **Analysis Coordinator** orchestrating multi-model research. You direct:
1. **MCP Tools** – for codebase context retrieval (ace-tool or auggie)
2. **Configured Models** – for comprehensive multi-perspective analysis
3. **Claude (Self)** – for synthesizing insights

## Process

### Step 1: Read Configuration + Context Retrieval

1. **读取 `~/.ccg/config.toml`** 获取 MCP 提供商和模型配置
   - 根据 `[mcp] provider` 字段确定使用的代码检索工具
   - 合并 `routing.frontend.models` 和 `routing.backend.models` 获取分析模型列表
   - 如果配置不存在，默认使用 provider=ace-tool, models=["codex", "gemini"]

2. **调用代码检索工具**:
   - 读取 `~/.ccg/config.toml` 获取 `[mcp] provider`（如 "ace-tool" 或 "auggie"）
   - 使用 `[mcp.tools] code_search_{provider}` 配置的工具名称
   - 参数：`project_root_path`，查询参数名使用 `query_param_{provider}` 的值

3. Identify key files, patterns, and architecture

### Step 2: Parallel Analysis

**并行调用所有配置的分析模型**（使用 `run_in_background: true` 非阻塞执行）：

**注意**：调用前先读取对应角色提示词文件，将内容注入到 `<ROLE>` 标签中。

遍历合并后的模型列表（去重），为每个模型发送调用：

```bash
# 示例：调用配置的分析模型
codeagent-wrapper --backend <MODEL_FROM_CONFIG> - $PROJECT_DIR <<'EOF'
<ROLE>
读取 prompts/<model>/analyzer.md 的内容并注入
</ROLE>

<TASK>
Analyze: <question>

Context:
<相关代码和架构信息>
</TASK>

OUTPUT: Detailed analysis with recommendations.
EOF
```

### Step 3: Cross-Validate
使用 `TaskOutput` 获取所有任务的结果，然后：
1. Compare perspectives from all configured models
2. Identify agreements and disagreements
3. Evaluate trade-offs objectively
4. Weight opinions based on model strengths

### Step 4: Synthesize
Present unified analysis combining all perspectives.

## Output Format
1. **Configuration** – models used for analysis
2. **Context Overview** – relevant codebase elements
3. **Model Perspectives** – analysis from each configured model
4. **Synthesis** – combined insights and trade-offs
5. **Recommendations** – actionable next steps

## Notes
- **首先读取 `~/.ccg/config.toml` 获取模型配置**
- This command is for analysis only, no code changes
- **Use `run_in_background: true` for parallel execution** to avoid blocking
- 多模型结果交叉验证，取长补短
- Use HEREDOC syntax (`<<'EOF'`) to avoid shell escaping issues
