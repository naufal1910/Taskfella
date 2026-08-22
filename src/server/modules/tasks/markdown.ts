import { AppError } from "@/server/http/errors";

const MAX_MARKDOWN_LENGTH = 50_000;
const SAFE_URL = /^(?:https?:|mailto:|\/|#)/i;

function assertMarkdown(value: unknown, maxLength = MAX_MARKDOWN_LENGTH): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new AppError("INVALID_REQUEST");
  }
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function isSafeUrl(value: string): boolean {
  return SAFE_URL.test(value.trim()) && !/^(?:javascript|vbscript|data):/i.test(value.trim());
}

/**
 * Markdown is a stored user-content boundary. Raw HTML is deliberately
 * removed, images are not part of the Phase 3 subset, and unsafe Markdown
 * link destinations become plain text rather than links.
 */
export function sanitizeMarkdown(value: unknown, maxLength = MAX_MARKDOWN_LENGTH): string {
  const markdown = assertMarkdown(value, maxLength)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "");

  return markdown
    .replace(/!\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(
      /\[([^\]]{1,1000})\]\(([^)\s]+)(?:\s+['\"][^)]*['\"])?\)/g,
      (_match, label: string, url: string) => (isSafeUrl(url) ? `[${label}](${url})` : label),
    );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineHtml(value: string): string {
  const tokens: string[] = [];
  const withPlaceholders = value.replace(
    /\[([^\]]{1,1000})\]\(([^)\s]+)(?:\s+['\"][^)]*['\"])?\)/g,
    (_match, label: string, url: string) => {
      if (!isSafeUrl(url)) return escapeHtml(label);
      const token = `\u0001${tokens.length}\u0002`;
      tokens.push(
        `<a href="${escapeHtml(url)}" rel="noreferrer noopener">${inlineHtml(label)}</a>`,
      );
      return token;
    },
  );

  let rendered = escapeHtml(withPlaceholders)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>");

  tokens.forEach((token, index) => {
    rendered = rendered.replace(`\u0001${index}\u0002`, token);
  });
  return rendered;
}

/**
 * Render only the constrained Markdown subset to generated, escaped HTML.
 * Consumers may use the result in a controlled `dangerouslySetInnerHTML`
 * boundary because all user text is escaped and all tags are generated here.
 */
export function renderMarkdown(value: unknown): string {
  const markdown = sanitizeMarkdown(value);
  const lines = markdown.split("\n");
  const output: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listType: "ul" | "ol" | undefined;

  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = undefined;
    }
  };

  const closeCode = () => {
    if (inCode) {
      output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
      inCode = false;
    }
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      closeList();
      if (inCode) closeCode();
      else inCode = true;
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (line.trim() === "") {
      closeList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const nextType = unordered ? "ul" : "ol";
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${inlineHtml((unordered ?? ordered)![1])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${inlineHtml(line)}</p>`);
  }

  closeList();
  closeCode();
  return output.join("");
}

export function normalizePlainText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new AppError("INVALID_REQUEST");
  }
  return normalized;
}
