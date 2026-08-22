import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TaskDetails } from "@/components/projects/task-board";
import type { TaskData } from "@/components/projects/project-api";

const project = {
  id: "00000000-0000-0000-0000-000000000001",
  accountId: "00000000-0000-0000-0000-000000000002",
  name: "Execution board",
  description: "",
  status: "active" as const,
  position: 0,
  revision: 1,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  columns: [
    {
      id: "00000000-0000-0000-0000-000000000003",
      projectId: "00000000-0000-0000-0000-000000000001",
      name: "Queued",
      role: "queued" as const,
      position: 0,
      wipMode: "none" as const,
      wipLimit: null,
      completedGrouping: "list" as const,
    },
  ],
  swimlanes: [],
  labels: [],
};

function task(color: string | null): TaskData {
  return {
    id: "00000000-0000-0000-0000-000000000004",
    accountId: project.accountId,
    projectId: project.id,
    columnId: project.columns[0]!.id,
    swimlaneId: null,
    title: "A task",
    description: "",
    color,
    dueDate: null,
    position: 0,
    revision: 0,
    completedAt: null,
    deletedAt: null,
    restoreColumnId: null,
    restoreSwimlaneId: null,
    restorePosition: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    labels: [],
    subtasks: [],
    notes: [],
    lifecycle: [],
  };
}

describe("task color details control", () => {
  it("keeps an uncolored task visibly unset while exposing an accessible clear action", () => {
    const html = renderToStaticMarkup(
      createElement(TaskDetails, {
        project,
        task: task(null),
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
      }),
    );

    expect(html).toContain('id="task-color"');
    expect(html).toContain('aria-describedby="task-color-help"');
    expect(html).toContain('aria-label="Clear card color"');
    expect(html).toContain("Clear card color");
    expect(html).toContain("No color set");
  });

  it("shows the saved color without replacing the clear action", () => {
    const html = renderToStaticMarkup(
      createElement(TaskDetails, {
        project,
        task: task("#246BCE"),
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
      }),
    );

    expect(html).toContain('value="#246BCE"');
    expect(html).toContain("Using #246BCE");
    expect(html).toContain('aria-label="Clear card color"');
  });
});
