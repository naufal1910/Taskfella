import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  TaskBoardColumn,
  TaskDetails,
  taskDropPosition,
} from "@/components/projects/task-board";
import type { SwimlaneData, TaskData } from "@/components/projects/project-api";

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
  swimlanes: [
    {
      id: "00000000-0000-0000-0000-000000000005",
      projectId: "00000000-0000-0000-0000-000000000001",
      name: "Personal",
      position: 0,
    },
    {
      id: "00000000-0000-0000-0000-000000000006",
      projectId: "00000000-0000-0000-0000-000000000001",
      name: "Later",
      position: 1,
    },
  ],
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

function lane(id: string, name: string, position: number): SwimlaneData {
  return {
    id,
    projectId: project.id,
    name,
    position,
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

  it("renders retained subtasks and notes from a full task snapshot", () => {
    const fullTask = task(null);
    fullTask.subtasks = [
      {
        id: "00000000-0000-0000-0000-000000000007",
        taskId: fullTask.id,
        projectId: project.id,
        accountId: project.accountId,
        text: "Existing checklist item",
        completed: true,
        position: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    fullTask.notes = [
      {
        id: "00000000-0000-0000-0000-000000000008",
        taskId: fullTask.id,
        projectId: project.id,
        accountId: project.accountId,
        body: "Existing journal note",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    fullTask.subtaskCount = 1;
    fullTask.completedSubtaskCount = 1;
    fullTask.noteCount = 1;

    const html = renderToStaticMarkup(
      createElement(TaskDetails, {
        project,
        task: fullTask,
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
      }),
    );

    expect(html).toContain("Existing checklist item");
    expect(html).toContain("Existing journal note");
    expect(html).toContain("1/1");
  });

  it("exposes accessible loading and retry states while the full snapshot is fetched", () => {
    const loadingHtml = renderToStaticMarkup(
      createElement(TaskDetails, {
        project,
        task: task(null),
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
        loading: true,
      }),
    );
    const retryHtml = renderToStaticMarkup(
      createElement(TaskDetails, {
        project,
        task: task(null),
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
        loadError: "The task could not be loaded.",
        onRetry: vi.fn(),
      }),
    );

    expect(loadingHtml).toContain('role="status"');
    expect(loadingHtml).toContain("Loading full task details");
    expect(retryHtml).toContain('role="alert"');
    expect(retryHtml).toContain("The task could not be loaded.");
    expect(retryHtml).toContain("Try again");
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

describe("task drop ordering", () => {
  it("places a downward drop at the target's post-removal slot", () => {
    const source = { ...task(null), id: "source", position: 0 };
    const target = { ...task(null), id: "target", position: 2 };
    const otherLaneTarget = {
      ...target,
      id: "other-lane-target",
      swimlaneId: project.swimlanes[0]!.id,
    };

    expect(taskDropPosition(source, target)).toBe(1);
    expect(taskDropPosition({ ...source, position: 2 }, { ...target, position: 0 })).toBe(0);
    expect(taskDropPosition(source, otherLaneTarget)).toBe(2);
  });
});

describe("task board lane presentation", () => {
  it("keeps persisted lane order visible and makes quick creation lane-aware", () => {
    const firstLane = lane(project.swimlanes[0]!.id, project.swimlanes[0]!.name, 1);
    const secondLane = lane(project.swimlanes[1]!.id, project.swimlanes[1]!.name, 0);
    const boardProject = { ...project, swimlanes: [firstLane, secondLane] };
    const personalLate = {
      ...task(null),
      id: "00000000-0000-0000-0000-000000000009",
      title: "Personal later",
      swimlaneId: firstLane.id,
      position: 1,
    };
    const personalFirst = {
      ...task(null),
      id: "00000000-0000-0000-0000-000000000010",
      title: "Personal first",
      swimlaneId: firstLane.id,
      position: 0,
    };
    const laterTask = {
      ...task(null),
      id: "00000000-0000-0000-0000-000000000011",
      title: "Later task",
      swimlaneId: secondLane.id,
      position: 0,
    };

    const html = renderToStaticMarkup(
      createElement(TaskBoardColumn, {
        column: project.columns[0]!,
        active: true,
        project: boardProject,
        tasks: [personalLate, laterTask, personalFirst],
        quickCreateSwimlaneId: firstLane.id,
        onQuickCreateSwimlaneChange: vi.fn(),
        disabled: false,
        onCreate: vi.fn(async () => undefined),
        onOpen: vi.fn(),
        onMove: vi.fn(),
        onDropOnTask: vi.fn(),
        onDropOnLane: vi.fn(),
      }),
    );

    expect(html).toContain("Swimlane for new task in Queued");
    expect(html).toContain('aria-label="Tasks in Queued, Personal"');
    expect(html).toContain('aria-label="Tasks in Queued, Later"');
    expect(html.indexOf("Later</h4>")).toBeLessThan(html.indexOf("Personal</h4>"));
    expect(html.indexOf("Personal first")).toBeLessThan(html.indexOf("Personal later"));
    expect(html).toContain("Personal");
    expect(html).toContain("Later task");
  });

  it("keeps archived tasks readable while disabling board mutations", () => {
    const archivedProject = {
      ...project,
      status: "archived" as const,
      archivedAt: "2026-01-02T00:00:00.000Z",
    };
    const archivedTask = { ...task(null), description: "Read-only description" };
    const columnHtml = renderToStaticMarkup(
      createElement(TaskBoardColumn, {
        column: archivedProject.columns[0]!,
        active: true,
        project: archivedProject,
        tasks: [archivedTask],
        quickCreateSwimlaneId: null,
        onQuickCreateSwimlaneChange: vi.fn(),
        disabled: true,
        onCreate: vi.fn(async () => undefined),
        onOpen: vi.fn(),
        onMove: vi.fn(),
        onDropOnTask: vi.fn(),
        onDropOnLane: vi.fn(),
      }),
    );
    expect(columnHtml).toContain('id="quick-create-00000000-0000-0000-0000-000000000003"');
    expect(columnHtml).toContain('disabled=""');
    expect(columnHtml).toContain('name="move-task-00000000-0000-0000-0000-000000000004"');

    const detailsHtml = renderToStaticMarkup(
      createElement(TaskDetails, {
        project: archivedProject,
        task: archivedTask,
        onClose: vi.fn(),
        onChanged: vi.fn(),
        trigger: null,
      }),
    );
    expect(detailsHtml).toContain('aria-readonly="true"');
    expect(detailsHtml).toContain("This project is archived and read-only.");
    expect(detailsHtml).toContain('value="A task"');
    expect(detailsHtml).toContain("Read-only description");
    expect(detailsHtml).toContain('aria-label="Clear card color"');
    expect(detailsHtml).toContain('disabled=""');
  });
});
