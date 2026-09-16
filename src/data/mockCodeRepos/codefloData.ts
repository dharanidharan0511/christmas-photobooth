import { fileNode, filesFromContent, type MockDirNode, type MockTreeRoot } from "./helpers";

const RAG_MIND_JSON = `{
  "id": "mind-rag-assistant-v2",
  "name": "RAG Assistant",
  "version": "2.1.0",
  "description": "Retrieval-augmented chat mind for workshop demos",
  "interface": {
    "mode": "chat",
    "inputs": [
      {
        "name": "repo_id",
        "type": "string",
        "label": "Code repository",
        "required": true
      },
      {
        "name": "top_k",
        "type": "number",
        "label": "Chunks to retrieve",
        "default": 5
      }
    ]
  },
  "steps": [
    {
      "id": "retrieve",
      "operator": "rag.retrieve",
      "inputs": {
        "repo_id": "{{ inputs.repo_id }}",
        "query": "{{ turn.user_message }}",
        "top_k": "{{ inputs.top_k }}"
      }
    },
    {
      "id": "answer",
      "operator": "llm.prompt",
      "inputs": {
        "system": "Answer using only the retrieved context.",
        "context": "{{ steps.retrieve.output.chunks }}",
        "user": "{{ turn.user_message }}"
      }
    }
  ],
  "governance": {
    "max_turns": 20,
    "token_budget": 120000
  }
}
`;

const CODE_REVIEW_MIND_JSON = `{
  "id": "mind-code-review-v1",
  "name": "Code Review",
  "version": "1.4.0",
  "description": "Reviews a diff and posts structured findings",
  "interface": {
    "mode": "chat",
    "inputs": [
      {
        "name": "repo_id",
        "type": "string",
        "required": true
      },
      {
        "name": "base_ref",
        "type": "string",
        "default": "main"
      }
    ]
  },
  "steps": [
    {
      "id": "diff",
      "operator": "code.diff",
      "inputs": {
        "repo_id": "{{ inputs.repo_id }}",
        "base_ref": "{{ inputs.base_ref }}"
      }
    },
    {
      "id": "review",
      "operator": "llm.prompt",
      "inputs": {
        "system": "You are a senior engineer performing a code review.",
        "user": "{{ steps.diff.output.patch }}"
      }
    }
  ]
}
`;

const CODEFLO_DEVELOP_CONTENT: Record<string, string> = {
  "README.md": `# CodeFlo Samples

Workshop-ready minds, operators, and prompt templates for edge CodeFlo deployments.

## Contents

| Path | Purpose |
|------|---------|
| \`minds/\` | Published mind JSON specs |
| \`operators/\` | Custom Python operators |
| \`prompts/\` | Reusable system prompts |
| \`datasources/\` | Example connector configs |

Import a mind through AI Studio or push via the edge sync pipeline.
`,

  "minds/rag-assistant.json": RAG_MIND_JSON,

  "minds/code-review.json": CODE_REVIEW_MIND_JSON,

  "minds/onboarding-bot.json": `{
  "id": "mind-onboarding-v1",
  "name": "Onboarding Bot",
  "version": "0.9.0",
  "interface": { "mode": "chat" },
  "steps": [
    {
      "id": "welcome",
      "operator": "llm.prompt",
      "inputs": {
        "system": "Guide new employees through their first-day checklist.",
        "user": "{{ turn.user_message }}"
      }
    }
  ]
}
`,

  "operators/custom_transform.py": `"""Example data transform operator used in workshops."""

from __future__ import annotations

from typing import Any


def transform(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize arbitrary JSON payloads before downstream LLM steps."""
    raw = payload.get("input", "")
    if isinstance(raw, dict):
        text = raw.get("text", "")
    else:
        text = str(raw)
    return {
        "result": text.strip(),
        "meta": {
            "source": payload.get("source", "unknown"),
            "length": len(text),
        },
    }


def validate(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if "input" not in payload:
        errors.append("missing input")
    return errors
`,

  "operators/repo_context_loader.py": `"""Loads file snippets from a linked code repo for RAG-style minds."""

from __future__ import annotations

from typing import Any


async def load_repo_context(repo_id: str, paths: list[str]) -> dict[str, Any]:
    # Workshop stub — real deployments call the engine code-repo APIs.
    snippets = {path: f"# stub content for {path}" for path in paths}
    return {"repo_id": repo_id, "snippets": snippets}
`,

  "prompts/rag-system.md": `You are a helpful assistant with access to retrieved repository context.

Rules:
1. Cite file paths when referencing code.
2. Say when the context is insufficient instead of guessing.
3. Prefer concise answers with bullet lists for multi-step instructions.
`,

  "prompts/code-review-rubric.md": `# Code review rubric

Score each finding:
- **severity**: blocker | major | minor | nit
- **category**: correctness | security | performance | style
- **suggestion**: actionable fix with example when possible
`,

  "datasources/sharepoint.example.json": `{
  "type": "sharepoint",
  "site_url": "https://contoso.sharepoint.com/sites/engineering",
  "library": "Shared Documents",
  "sync_schedule": "0 */6 * * *",
  "acl_enrichment": true
}
`,

  "workshops/01-rag-quickstart.md": `# Workshop 1 — RAG Quickstart

1. Link a code repo to your edge project
2. Import \`minds/rag-assistant.json\`
3. Run with \`repo_id\` set to the linked repository
4. Ask questions about files in the default branch
`,
};

const CODEFLO_MAIN_CONTENT: Record<string, string> = {
  "README.md": `# CodeFlo Samples (main)

Stable branch — ships the production-ready RAG assistant mind only.
Use \`develop\` for experimental minds and workshop assets.
`,

  "minds/rag-assistant.json": RAG_MIND_JSON,

  "prompts/rag-system.md": CODEFLO_DEVELOP_CONTENT["prompts/rag-system.md"]!,
};

function treeFromContent(content: Record<string, string>): MockTreeRoot {
  const root: MockTreeRoot = {};
  for (const path of Object.keys(content)) {
    const parts = path.split("/");
    let current: MockTreeRoot | MockDirNode["children"] = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      if (isFile) {
        current[part] = fileNode(content[path]!);
      } else {
        if (!current[part] || current[part].type !== "dir") {
          current[part] = { type: "dir", children: {} };
        }
        current = (current[part] as MockDirNode).children;
      }
    }
  }
  return root;
}

export const CODEFLO_TREES_BY_BRANCH = {
  develop: treeFromContent(CODEFLO_DEVELOP_CONTENT),
  main: treeFromContent(CODEFLO_MAIN_CONTENT),
};

export const CODEFLO_FILES_BY_BRANCH = {
  develop: filesFromContent(CODEFLO_DEVELOP_CONTENT),
  main: filesFromContent(CODEFLO_MAIN_CONTENT),
};
