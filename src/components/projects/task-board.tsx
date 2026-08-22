"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Button, StatusBadge } from "@/components/ui/primitives";
import { renderMarkdown } from "@/server/modules/tasks/markdown";
import {
  apiRequest,
  type LabelData,
  type ProjectColumnData,
  type ProjectData,
  type SubtaskData,
  type SwimlaneData,
  type TaskData,
} from "./project-api";

type BoardProject = ProjectData & {
  columns: ProjectColumnData[];
  swimlanes: SwimlaneData[];
  labels: LabelData[];
};

type TaskResponse = { task: TaskData };
type TaskListResponse = { tasks: TaskData[] };
type TaskLane = { id: string | null; name: string };
type CreateTask = (
  title: string,
  details: boolean,
  columnId: string,
  swimlaneId: string | null,
) => Promise<void>;
type MoveTask = (
  task: TaskData,
  columnId: string,
  swimlaneId: string | null,
  position?: number,
) => void;

type TaskDetailState = {
  task: TaskData;
  trigger: HTMLElement | null;
  loading: boolean;
  error?: string;
};

const DEFAULT_TASK_COLOR = "#0F766E";

function orderTasks(taskItems: TaskData[]): TaskData[] {
  return [...taskItems].sort(
    (left, right) =>
      left.position - right.position ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

function orderSwimlanes(laneItems: SwimlaneData[]): SwimlaneData[] {
  return [...laneItems].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id),
  );
}

function taskUrl(projectId: string, taskId: string, suffix = "") {
  return `/api/projects/${projectId}/tasks/${taskId}${suffix}`;
}

function errorCode(error: unknown): string | undefined {
  return (error as Error & { code?: string }).code;
}

function dueLabel(dueDate: string | null): string | undefined {
  if (!dueDate) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) return "Overdue";
  if (dueDate === today) return "Due today";
  return `Due ${dueDate}`;
}

function TaskCard({
  task,
  project,
  readOnly,
  onOpen,
  onMove,
  onDropOnTask,
}: {
  task: TaskData;
  project: BoardProject;
  readOnly: boolean;
  onOpen: (task: TaskData, trigger: HTMLElement) => void;
  onMove: MoveTask;
  onDropOnTask: (event: DragEvent<HTMLElement>, task: TaskData) => void;
}) {
  const [moveValue, setMoveValue] = useState("");
  const currentColumn = project.columns.find((column) => column.id === task.columnId);
  const currentSwimlane = project.swimlanes.find((lane) => lane.id === task.swimlaneId);
  const due = dueLabel(task.dueDate);

  return (
    <div
      className="task-card"
      draggable={!task.deletedAt && !readOnly}
      style={task.color ? { borderInlineStartColor: task.color } : undefined}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", task.id);
      }}
      onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
      onDrop={readOnly ? undefined : (event) => onDropOnTask(event, task)}
      aria-label={`Task ${task.title}`}
      role="listitem"
    >
      <div className="task-card__topline">
        {currentColumn && <span className="task-card__column">{currentColumn.name}</span>}
        <span className="task-card__swimlane">{currentSwimlane?.name ?? "No swimlane"}</span>
        {task.completedAt && <StatusBadge status="success">Completed</StatusBadge>}
        {task.deletedAt && <StatusBadge status="warning">Trash</StatusBadge>}
      </div>
      <button
        className="task-card__title"
        type="button"
        onClick={(event) => onOpen(task, event.currentTarget)}
      >
        {task.title}
      </button>
      <div className="task-card__meta">
        {due && (
          <span
            className={
              due === "Overdue" ? "task-card__due task-card__due--overdue" : "task-card__due"
            }
          >
            {due}
          </span>
        )}
        {task.labels.map((label) => (
          <span className="task-label" key={label.id} style={{ borderColor: label.color }}>
            {label.name}
          </span>
        ))}
        {(task.subtaskCount ?? 0) > 0 && (
          <span
            aria-label={`${task.completedSubtaskCount ?? 0} of ${task.subtaskCount} subtasks complete`}
          >
            ✓ {task.completedSubtaskCount}/{task.subtaskCount}
          </span>
        )}
        {(task.noteCount ?? 0) > 0 && (
          <span aria-label={`${task.noteCount} notes`}>▤ {task.noteCount}</span>
        )}
      </div>
      {!task.deletedAt ? (
        <div className="task-card__actions">
          <label className="task-move-control">
            <span className="sr-only">Move {task.title} to</span>
            <select
              id={`move-task-${task.id}`}
              name={`move-task-${task.id}`}
              aria-label={`Move ${task.title} to another column while keeping it in ${
                currentSwimlane?.name ?? "No swimlane"
              }`}
              value={moveValue}
              disabled={readOnly}
              onChange={(event) => {
                const destination = event.target.value;
                setMoveValue("");
                if (destination) onMove(task, destination, task.swimlaneId);
              }}
            >
              <option value="">Move to…</option>
              {project.columns.map((column) => (
                <option value={column.id} key={column.id} disabled={column.id === task.columnId}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            type="button"
            onClick={(event) => onOpen(task, event.currentTarget)}
          >
            Details
          </button>
          <button
            className="text-button"
            type="button"
            aria-label={`Move ${task.title} up`}
            onClick={() =>
              onMove(task, task.columnId, task.swimlaneId, Math.max(0, task.position - 1))
            }
            disabled={readOnly || task.position === 0}
          >
            ↑
          </button>
          <button
            className="text-button"
            type="button"
            aria-label={`Move ${task.title} down`}
            onClick={() => onMove(task, task.columnId, task.swimlaneId, task.position + 1)}
            disabled={readOnly}
          >
            ↓
          </button>
        </div>
      ) : (
        <div className="task-card__actions">
          <button
            className="text-button"
            type="button"
            onClick={(event) => onOpen(task, event.currentTarget)}
          >
            Restore or delete
          </button>
        </div>
      )}
    </div>
  );
}

function QuickCreate({
  columnId,
  columnName,
  swimlaneId,
  swimlanes,
  disabled,
  onSwimlaneChange,
  onCreate,
}: {
  columnId: string;
  columnName: string;
  swimlaneId: string | null;
  swimlanes: SwimlaneData[];
  disabled: boolean;
  onSwimlaneChange: (swimlaneId: string | null) => void;
  onCreate: CreateTask;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>, details = false) {
    event.preventDefault();
    const value = title.trim();
    if (!value || disabled) return;
    await onCreate(value, details, columnId, swimlaneId);
    setTitle("");
    if (!details) inputRef.current?.focus();
  }

  return (
    <form className="quick-create" onSubmit={(event) => void submit(event)}>
      <label className="sr-only" htmlFor={`quick-create-${columnId}`}>
        Add task to {columnName}
      </label>
      <input
        ref={inputRef}
        id={`quick-create-${columnId}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a task…"
        maxLength={240}
        disabled={disabled}
      />
      <label className="quick-create__lane" htmlFor={`quick-create-${columnId}-swimlane`}>
        Swimlane for new task in {columnName}
        <select
          id={`quick-create-${columnId}-swimlane`}
          value={swimlaneId ?? ""}
          onChange={(event) => onSwimlaneChange(event.target.value || null)}
          disabled={disabled}
        >
          <option value="">No swimlane</option>
          {swimlanes.map((lane) => (
            <option value={lane.id} key={lane.id}>
              {lane.name}
            </option>
          ))}
        </select>
      </label>
      <div className="quick-create__actions">
        <button
          className="ui-button ui-button--primary"
          type="submit"
          disabled={disabled || !title.trim()}
        >
          Add task
        </button>
        <button
          className="text-button"
          type="button"
          disabled={disabled || !title.trim()}
          onClick={(event) => void submit(event as unknown as FormEvent<HTMLFormElement>, true)}
        >
          Add details
        </button>
      </div>
    </form>
  );
}

export function TaskBoardColumn({
  column,
  active,
  project,
  tasks,
  quickCreateSwimlaneId,
  onQuickCreateSwimlaneChange,
  disabled,
  onCreate,
  onOpen,
  onMove,
  onDropOnTask,
  onDropOnLane,
}: {
  column: ProjectColumnData;
  active: boolean;
  project: BoardProject;
  tasks: TaskData[];
  quickCreateSwimlaneId: string | null;
  onQuickCreateSwimlaneChange: (swimlaneId: string | null) => void;
  disabled: boolean;
  onCreate: CreateTask;
  onOpen: (task: TaskData, trigger: HTMLElement) => void;
  onMove: MoveTask;
  onDropOnTask: (event: DragEvent<HTMLElement>, task: TaskData) => void;
  onDropOnLane: (
    event: DragEvent<HTMLElement>,
    columnId: string,
    swimlaneId: string | null,
  ) => void;
}) {
  const columnTasks = orderTasks(tasks.filter((task) => task.columnId === column.id));
  const orderedSwimlanes = orderSwimlanes(project.swimlanes);
  const lanes: TaskLane[] = [
    { id: null, name: "No swimlane" },
    ...orderedSwimlanes.map((lane) => ({ id: lane.id, name: lane.name })),
  ];
  return (
    <article
      className={`task-board-column ${active ? "task-board-column--mobile-active" : ""}`}
      aria-labelledby={`task-column-${column.id}`}
    >
      <header className="task-board-column__header">
        <div>
          <p className="column-role">{column.role}</p>
          <h3 id={`task-column-${column.id}`}>{column.name}</h3>
        </div>
        <span className="column-count" aria-label={`${columnTasks.length} visible tasks`}>
          {columnTasks.length}
        </span>
      </header>
      <div className="board-column__meta">
        <span className={`wip-badge wip-badge--${column.wipMode}`}>
          WIP {column.wipMode}
          {column.wipLimit ? ` · ${column.wipLimit}` : ""}
        </span>
        {column.role === "active" && <StatusBadge status="success">Focus destination</StatusBadge>}
        {column.role === "completed" && (
          <StatusBadge status="neutral">Completion meaning</StatusBadge>
        )}
      </div>
      <QuickCreate
        columnId={column.id}
        columnName={column.name}
        swimlaneId={quickCreateSwimlaneId}
        swimlanes={orderedSwimlanes}
        disabled={disabled}
        onSwimlaneChange={onQuickCreateSwimlaneChange}
        onCreate={onCreate}
      />
      <div className="task-board-lane-groups">
        {lanes.map((lane) => {
          const laneTasks = columnTasks.filter((task) => task.swimlaneId === lane.id);
          const laneHeadingId = `task-lane-${column.id}-${lane.id ?? "none"}`;
          return (
            <section
              className="task-board-lane"
              key={lane.id ?? "none"}
              aria-labelledby={laneHeadingId}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDropOnLane(event, column.id, lane.id)}
            >
              <header className="task-board-lane__header">
                <div>
                  <p className="column-role">Swimlane</p>
                  <h4 id={laneHeadingId}>{lane.name}</h4>
                </div>
                <span className="column-count" aria-label={`${laneTasks.length} visible tasks`}>
                  {laneTasks.length}
                </span>
              </header>
              <div
                className="task-card-list"
                role="list"
                aria-label={`Tasks in ${column.name}, ${lane.name}`}
              >
                {laneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={project}
                    readOnly={disabled}
                    onOpen={onOpen}
                    onMove={onMove}
                    onDropOnTask={onDropOnTask}
                  />
                ))}
                {laneTasks.length === 0 && (
                  <p className="task-board-empty" role="listitem">
                    Drop a task here or add one above.
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function MarkdownPreview({ value }: { value: string }) {
  if (!value.trim()) return <p className="markdown-empty">No description yet.</p>;
  return (
    <div className="markdown-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
  );
}

export function TaskDetails({
  project,
  task,
  onClose,
  onChanged,
  trigger,
  loading = false,
  loadError,
  onRetry,
}: {
  project: BoardProject;
  task: TaskData;
  onClose: () => void;
  onChanged: (task: TaskData) => void;
  trigger: HTMLElement | null;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [columnId, setColumnId] = useState(task.columnId);
  const [swimlaneId, setSwimlaneId] = useState(task.swimlaneId ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [color, setColor] = useState<string | null>(task.color);
  const [labelIds, setLabelIds] = useState(task.labels.map((label) => label.id));
  const [subtaskText, setSubtaskText] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const previousFocus = useRef<HTMLElement | null>(trigger);
  const readOnly = project.status === "archived";

  useEffect(() => {
    const previous = previousFocus.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(undefined);
    const payload = {
      title,
      description,
      columnId,
      swimlaneId: swimlaneId || null,
      dueDate: dueDate || null,
      color,
      labelIds,
      expectedRevision: task.revision,
    };
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id), {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      onChanged(response.task);
    } catch (caught) {
      if (
        errorCode(caught) === "WIP_CONFIRMATION_REQUIRED" &&
        window.confirm("This column is at its WIP warning limit. Save the move anyway?")
      ) {
        try {
          const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id), {
            method: "PATCH",
            body: JSON.stringify({ ...payload, warningConfirmed: true }),
          });
          onChanged(response.task);
        } catch (retryError) {
          setError(
            retryError instanceof Error ? retryError.message : "We could not save this task.",
          );
        }
      } else {
        setError(caught instanceof Error ? caught.message : "We could not save this task.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !subtaskText.trim()) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id, "/subtasks"), {
        method: "POST",
        body: JSON.stringify({ text: subtaskText }),
      });
      setSubtaskText("");
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not add that subtask.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubtask(subtask: SubtaskData) {
    if (readOnly) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(
        taskUrl(project.id, task.id, `/subtasks/${subtask.id}`),
        {
          method: "PATCH",
          body: JSON.stringify({ completed: !subtask.completed }),
        },
      );
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not update that subtask.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubtask(subtask: SubtaskData) {
    if (readOnly || !window.confirm(`Delete subtask “${subtask.text}”?`)) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(
        taskUrl(project.id, task.id, `/subtasks/${subtask.id}`),
        { method: "DELETE", body: "{}" },
      );
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete that subtask.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || !noteBody.trim()) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id, "/notes"), {
        method: "POST",
        body: JSON.stringify({ body: noteBody }),
      });
      setNoteBody("");
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not add that note.");
    } finally {
      setSaving(false);
    }
  }

  async function editNote(note: NonNullable<TaskData["notes"]>[number]) {
    if (readOnly) return;
    const body = window.prompt("Edit note Markdown", note.body);
    if (body === null || !body.trim()) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(
        taskUrl(project.id, task.id, `/notes/${note.id}`),
        { method: "PATCH", body: JSON.stringify({ body }) },
      );
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not edit that note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(note: NonNullable<TaskData["notes"]>[number]) {
    if (readOnly || !window.confirm("Delete this personal note?")) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(
        taskUrl(project.id, task.id, `/notes/${note.id}`),
        { method: "DELETE", body: "{}" },
      );
      onChanged(response.task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete that note.");
    } finally {
      setSaving(false);
    }
  }

  async function trash() {
    if (
      readOnly ||
      !window.confirm("Move this task to Trash? Its notes, subtasks, and history will be retained.")
    )
      return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id), {
        method: "DELETE",
        body: "{}",
      });
      onChanged(response.task);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not move this task to Trash.");
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    if (readOnly) return;
    setSaving(true);
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id, "/restore"), {
        method: "POST",
        body: "{}",
      });
      onChanged(response.task);
      onClose();
    } catch (caught) {
      if (
        errorCode(caught) === "WIP_CONFIRMATION_REQUIRED" &&
        window.confirm("The destination is at its WIP warning limit. Restore anyway?")
      ) {
        const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id, "/restore"), {
          method: "POST",
          body: JSON.stringify({ warningConfirmed: true }),
        });
        onChanged(response.task);
        onClose();
      } else {
        setError(caught instanceof Error ? caught.message : "We could not restore this task.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function permanentlyDelete() {
    if (readOnly) return;
    const confirmation = window.prompt(
      `Type the task title exactly to permanently delete “${task.title}”.`,
    );
    if (confirmation === null) return;
    setSaving(true);
    try {
      await apiRequest(taskUrl(project.id, task.id, "/permanent-delete"), {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      onClose();
      onChanged({ ...task, deletedAt: "deleted" });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "We could not permanently delete this task.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="task-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className="task-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        aria-describedby="task-detail-context"
        aria-readonly={readOnly}
        aria-busy={loading}
      >
        <header className="task-detail-panel__header">
          <div>
            <p className="eyebrow">Task details</p>
            <h2 id="task-detail-title">{task.title}</h2>
            <p id="task-detail-context" className="task-detail-context">
              {project.name} ·{" "}
              {project.columns.find((column) => column.id === task.columnId)?.name ?? "Board"}
            </p>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            type="button"
            aria-label="Close task details and return to board"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {(error ?? loadError) && (
          <p className="form-error" role="alert">
            {error ?? loadError}
          </p>
        )}
        {readOnly && (
          <p className="inline-alert" role="status">
            This project is archived and read-only. Restore it to change tasks or board data.
          </p>
        )}
        {loading ? (
          <div className="loading-panel" role="status" aria-live="polite">
            Loading full task details…
          </div>
        ) : loadError ? (
          <div className="task-detail-load-error">
            <button
              className="ui-button ui-button--secondary"
              type="button"
              onClick={() => onRetry?.()}
              disabled={!onRetry}
            >
              Try again
            </button>
          </div>
        ) : task.deletedAt ? (
          <div className="task-trash-actions">
            <p>This task is in Trash. Its planning history is retained until permanent deletion.</p>
            <div className="dialog-actions">
              <Button
                variant="primary"
                onClick={() => void restore()}
                disabled={saving || readOnly}
              >
                Restore task
              </Button>
              <button
                className="ui-button ui-button--destructive"
                type="button"
                onClick={() => void permanentlyDelete()}
                disabled={saving || readOnly}
              >
                Delete permanently
              </button>
            </div>
          </div>
        ) : (
          <>
            <form className="task-detail-form" onSubmit={(event) => void save(event)}>
              <label className="field" htmlFor="task-title">
                Title
                <input
                  id="task-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={240}
                  required
                  disabled={readOnly}
                />
              </label>
              <label className="field" htmlFor="task-description">
                Description{" "}
                <span className="field-optional">Markdown, sanitized before storage</span>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  maxLength={50000}
                  disabled={readOnly}
                />
              </label>
              <div className="task-detail-grid">
                <label className="field" htmlFor="task-column">
                  Column
                  <select
                    id="task-column"
                    value={columnId}
                    onChange={(event) => setColumnId(event.target.value)}
                    disabled={readOnly}
                  >
                    {project.columns.map((column) => (
                      <option value={column.id} key={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" htmlFor="task-swimlane">
                  Swimlane
                  <select
                    id="task-swimlane"
                    value={swimlaneId}
                    onChange={(event) => setSwimlaneId(event.target.value)}
                    disabled={readOnly}
                  >
                    <option value="">No swimlane</option>
                    {project.swimlanes.map((lane) => (
                      <option value={lane.id} key={lane.id}>
                        {lane.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" htmlFor="task-due-date">
                  Due date <span className="field-optional">Calendar date</span>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    disabled={readOnly}
                  />
                </label>
                <div className="field">
                  <label htmlFor="task-color">Card color</label>
                  <input
                    id="task-color"
                    type="color"
                    value={color ?? DEFAULT_TASK_COLOR}
                    aria-describedby="task-color-help"
                    onChange={(event) => setColor(event.target.value)}
                    disabled={readOnly}
                  />
                  <button
                    className="text-button"
                    type="button"
                    aria-label="Clear card color"
                    onClick={() => setColor(null)}
                    disabled={readOnly}
                  >
                    Clear card color
                  </button>
                  <span id="task-color-help" className="field-help">
                    {color ? `Using ${color}` : "No color set"}
                  </span>
                </div>
              </div>
              <fieldset className="task-label-picker">
                <legend>Labels</legend>
                <div className="task-label-picker__options">
                  {project.labels.map((label) => (
                    <label key={label.id}>
                      <input
                        type="checkbox"
                        checked={labelIds.includes(label.id)}
                        disabled={readOnly}
                        onChange={(event) =>
                          setLabelIds((current) =>
                            event.target.checked
                              ? [...current, label.id]
                              : current.filter((id) => id !== label.id),
                          )
                        }
                      />
                      {label.name}
                    </label>
                  ))}
                  {project.labels.length === 0 && (
                    <span className="field-help">Create board labels below.</span>
                  )}
                </div>
              </fieldset>
              <div className="markdown-preview">
                <p className="eyebrow">Preview</p>
                <MarkdownPreview value={description} />
              </div>
              <div className="dialog-actions">
                <Button variant="primary" type="submit" disabled={saving || readOnly}>
                  {saving ? "Saving…" : "Save details"}
                </Button>
                <button
                  className="ui-button ui-button--destructive"
                  type="button"
                  onClick={() => void trash()}
                  disabled={saving || readOnly}
                >
                  Move to Trash
                </button>
              </div>
            </form>
            <section className="task-detail-section" aria-labelledby="subtasks-title">
              <div className="task-section-heading">
                <h3 id="subtasks-title">Subtasks</h3>
                <span>
                  {task.completedSubtaskCount ??
                    task.subtasks?.filter((item) => item.completed).length ??
                    0}
                  /{task.subtaskCount ?? task.subtasks?.length ?? 0}
                </span>
              </div>
              <ul className="subtask-list">
                {(task.subtasks ?? []).map((subtask) => (
                  <li key={subtask.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={subtask.completed}
                        onChange={() => void toggleSubtask(subtask)}
                        disabled={saving || readOnly}
                      />{" "}
                      <span className={subtask.completed ? "is-complete" : undefined}>
                        {subtask.text}
                      </span>
                    </label>
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      onClick={() => void deleteSubtask(subtask)}
                      disabled={saving || readOnly}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <form className="compact-form" onSubmit={(event) => void addSubtask(event)}>
                <label className="sr-only" htmlFor="new-subtask">
                  New subtask
                </label>
                <input
                  id="new-subtask"
                  value={subtaskText}
                  onChange={(event) => setSubtaskText(event.target.value)}
                  placeholder="Add a checklist item"
                  maxLength={500}
                  disabled={readOnly}
                />
                <button
                  className="ui-button ui-button--secondary"
                  type="submit"
                  disabled={saving || readOnly || !subtaskText.trim()}
                >
                  Add
                </button>
              </form>
            </section>
            <section className="task-detail-section" aria-labelledby="notes-title">
              <div className="task-section-heading">
                <h3 id="notes-title">Notes</h3>
                <span>Chronological journal</span>
              </div>
              <ol className="task-notes">
                {(task.notes ?? []).map((note) => (
                  <li key={note.id}>
                    <div
                      className="markdown-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }}
                    />
                    <time dateTime={note.createdAt}>
                      {new Date(note.createdAt).toLocaleString()}
                    </time>
                    <div className="task-note-actions">
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => void editNote(note)}
                        disabled={saving || readOnly}
                      >
                        Edit
                      </button>
                      <button
                        className="text-button text-button--danger"
                        type="button"
                        onClick={() => void deleteNote(note)}
                        disabled={saving || readOnly}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <form className="task-note-form" onSubmit={(event) => void addNote(event)}>
                <label className="field" htmlFor="new-note">
                  Add a note
                  <textarea
                    id="new-note"
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={3}
                    maxLength={20000}
                    disabled={readOnly}
                  />
                </label>
                <button
                  className="ui-button ui-button--secondary"
                  type="submit"
                  disabled={saving || readOnly || !noteBody.trim()}
                >
                  Add note
                </button>
              </form>
            </section>
          </>
        )}
        <p className="task-detail-help">
          Press Escape to close. All board actions also have keyboard and touch-sized controls.
        </p>
      </aside>
    </div>
  );
}

export function TaskBoard({ project }: { project: BoardProject }) {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [selectedColumnId, setSelectedColumnId] = useState(project.columns[0]?.id);
  const [selectedSwimlaneId, setSelectedSwimlaneId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [labelId, setLabelId] = useState("");
  const [color, setColor] = useState("");
  const [due, setDue] = useState("");
  const [columnFilter, setColumnFilter] = useState("");
  const [swimlaneFilter, setSwimlaneFilter] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<TaskDetailState>();
  const [draggedTaskId, setDraggedTaskId] = useState<string>();
  const detailRequestId = useRef(0);
  const detailHistoryEntry = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async () => {
    setPending(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (labelId) params.set("labelId", labelId);
      if (color) params.set("color", color);
      if (due) params.set("due", due);
      if (columnFilter) params.set("columnId", columnFilter);
      if (swimlaneFilter) params.set("swimlaneId", swimlaneFilter);
      if (showTrash) params.set("trash", "true");
      const response = await apiRequest<TaskListResponse>(
        `/api/projects/${project.id}/tasks?${params}`,
      );
      setTasks(response.tasks);
      setError(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not load the tasks.");
    } finally {
      setPending(false);
    }
  }, [color, columnFilter, due, labelId, project.id, search, showTrash, swimlaneFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTasks(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTasks]);

  useEffect(() => {
    const onPopState = () => {
      if (detailHistoryEntry.current) {
        detailHistoryEntry.current = false;
        setDetail(undefined);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const visibleColumns = useMemo(
    () => project.columns.filter((column) => !columnFilter || column.id === columnFilter),
    [columnFilter, project.columns],
  );
  const activeColumn =
    selectedColumnId && visibleColumns.some((column) => column.id === selectedColumnId)
      ? selectedColumnId
      : visibleColumns[0]?.id;
  const quickCreateSwimlaneId =
    selectedSwimlaneId && project.swimlanes.some((lane) => lane.id === selectedSwimlaneId)
      ? selectedSwimlaneId
      : null;
  const availableColors = useMemo(
    () => [
      ...new Set([
        ...tasks.map((task) => task.color).filter((value): value is string => Boolean(value)),
        ...project.labels.map((label) => label.color),
      ]),
    ],
    [project.labels, tasks],
  );

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (event.key.toLowerCase() === "n" && !showTrash && project.status !== "archived") {
        event.preventDefault();
        if (activeColumn) document.getElementById(`quick-create-${activeColumn}`)?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [activeColumn, project.status, showTrash]);

  async function loadTaskDetails(taskId: string, requestId: number) {
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, taskId));
      if (requestId !== detailRequestId.current) return;
      setDetail((current) =>
        current && current.task.id === taskId
          ? { ...current, task: response.task, loading: false, error: undefined }
          : current,
      );
    } catch (caught) {
      if (requestId !== detailRequestId.current) return;
      setDetail((current) =>
        current && current.task.id === taskId
          ? {
              ...current,
              loading: false,
              error: caught instanceof Error ? caught.message : "We could not load this task.",
            }
          : current,
      );
    }
  }

  function openTask(task: TaskData, trigger: HTMLElement) {
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    window.history.pushState(
      { ...(window.history.state ?? {}), taskDetails: true },
      "",
      window.location.href,
    );
    detailHistoryEntry.current = true;
    setDetail({ task, trigger, loading: true });
    void loadTaskDetails(task.id, requestId);
  }

  const closeDetails = useCallback(() => {
    detailRequestId.current += 1;
    setDetail(undefined);
    if (detailHistoryEntry.current) {
      detailHistoryEntry.current = false;
      window.history.back();
    }
  }, []);

  function retryTaskDetails() {
    if (!detail) return;
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setDetail((current) => (current ? { ...current, loading: true, error: undefined } : current));
    void loadTaskDetails(detail.task.id, requestId);
  }

  function changedTask(task: TaskData) {
    setDetail((current) =>
      current ? { ...current, task, loading: false, error: undefined } : current,
    );
    void loadTasks();
  }

  async function create(
    title: string,
    details: boolean,
    columnId: string,
    swimlaneId: string | null,
  ) {
    if (project.status === "archived") return;
    try {
      const response = await apiRequest<TaskResponse>(`/api/projects/${project.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, columnId, swimlaneId }),
      });
      if (details) openTask(response.task, document.activeElement as HTMLElement);
      await loadTasks();
    } catch (caught) {
      if (
        errorCode(caught) === "WIP_CONFIRMATION_REQUIRED" &&
        window.confirm("This column is at its WIP warning limit. Add the task anyway?")
      ) {
        const response = await apiRequest<TaskResponse>(`/api/projects/${project.id}/tasks`, {
          method: "POST",
          body: JSON.stringify({ title, columnId, swimlaneId, warningConfirmed: true }),
        });
        if (details) openTask(response.task, document.activeElement as HTMLElement);
        await loadTasks();
      } else setError(caught instanceof Error ? caught.message : "We could not create that task.");
    }
  }

  async function move(
    task: TaskData,
    columnId: string,
    swimlaneId: string | null,
    position?: number,
    warningConfirmed = false,
  ) {
    if (project.status === "archived") return;
    try {
      const response = await apiRequest<TaskResponse>(taskUrl(project.id, task.id, "/move"), {
        method: "POST",
        body: JSON.stringify({ columnId, swimlaneId, position, warningConfirmed }),
      });
      changedTask(response.task);
    } catch (caught) {
      if (
        errorCode(caught) === "WIP_CONFIRMATION_REQUIRED" &&
        window.confirm("This move reaches the column WIP warning. Move it anyway?")
      ) {
        await move(task, columnId, swimlaneId, position, true);
      } else setError(caught instanceof Error ? caught.message : "We could not move that task.");
    }
  }

  function dropOnLane(event: DragEvent<HTMLElement>, columnId: string, swimlaneId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
    const task = tasks.find((item) => item.id === taskId);
    if (task) void move(task, columnId, swimlaneId);
    setDraggedTaskId(undefined);
  }

  function dropOnTask(event: DragEvent<HTMLElement>, target: TaskData) {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
    const task = tasks.find((item) => item.id === taskId);
    if (task && task.id !== target.id)
      void move(task, target.columnId, target.swimlaneId, target.position);
    setDraggedTaskId(undefined);
  }

  return (
    <>
      <section className="task-board-tools" aria-labelledby="task-board-tools-title">
        <div className="task-board-tools__heading">
          <div>
            <p className="eyebrow">Phase 3 execution</p>
            <h2 id="task-board-tools-title">Plan and move your work</h2>
          </div>
          <div className="task-board-view-toggle" role="group" aria-label="Task view">
            <button
              className={!showTrash ? "is-selected" : ""}
              type="button"
              onClick={() => setShowTrash(false)}
            >
              Board
            </button>
            <button
              className={showTrash ? "is-selected" : ""}
              type="button"
              onClick={() => setShowTrash(true)}
            >
              Trash
            </button>
          </div>
        </div>
        <div className="task-filter-grid">
          <label className="field task-search-field" htmlFor="task-search">
            Search tasks, notes, and subtasks
            <input
              ref={searchInputRef}
              id="task-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search…"
            />
          </label>
          <label className="field" htmlFor="task-label-filter">
            Label
            <select
              id="task-label-filter"
              value={labelId}
              onChange={(event) => setLabelId(event.target.value)}
            >
              <option value="">All labels</option>
              {project.labels.map((label) => (
                <option value={label.id} key={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="task-color-filter">
            Color
            <select
              id="task-color-filter"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            >
              <option value="">All colors</option>
              {availableColors.map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="task-due-filter">
            Due date
            <select
              id="task-due-filter"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            >
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="this-week">This week</option>
              <option value="no-date">No due date</option>
              <option value="has-date">Has due date</option>
            </select>
          </label>
          <label className="field" htmlFor="task-column-filter">
            Column
            <select
              id="task-column-filter"
              value={columnFilter}
              onChange={(event) => {
                setColumnFilter(event.target.value);
                setSelectedColumnId(event.target.value || project.columns[0]?.id);
              }}
            >
              <option value="">All columns</option>
              {project.columns.map((column) => (
                <option value={column.id} key={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="task-swimlane-filter">
            Swimlane
            <select
              id="task-swimlane-filter"
              value={swimlaneFilter}
              onChange={(event) => setSwimlaneFilter(event.target.value)}
            >
              <option value="">All swimlanes</option>
              <option value="none">No swimlane</option>
              {project.swimlanes.map((lane) => (
                <option value={lane.id} key={lane.id}>
                  {lane.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="task-board-hint" aria-live="polite">
          {project.status === "archived"
            ? "This project is archived and read-only. Restore it to change tasks or board data."
            : showTrash
              ? "Trash keeps task history until you deliberately delete it permanently."
              : "Drag is optional. Use Move to…, the arrow buttons, or the task details panel with keyboard or touch."}
        </p>
      </section>
      {error && (
        <p className="inline-alert" role="alert">
          {error}{" "}
          <button className="text-button" type="button" onClick={() => void loadTasks()}>
            Try again
          </button>
        </p>
      )}
      {pending ? (
        <div className="loading-panel" role="status">
          Loading tasks…
        </div>
      ) : showTrash ? (
        <section className="trash-board" aria-labelledby="trash-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recoverable history</p>
              <h2 id="trash-title">Trash</h2>
            </div>
            <span className="section-count">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-panel">
              <h3>Trash is empty</h3>
              <p>
                Deleted tasks will stay here until you restore or deliberately permanently delete
                them.
              </p>
            </div>
          ) : (
            <div className="trash-list" role="list" aria-label="Tasks in Trash">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  project={project}
                  readOnly={project.status === "archived"}
                  onOpen={openTask}
                  onMove={() => undefined}
                  onDropOnTask={() => undefined}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="mobile-task-column-picker">
            <label className="field" htmlFor="task-mobile-column">
              Show column on mobile
              <select
                id="task-mobile-column"
                value={activeColumn ?? ""}
                onChange={(event) => setSelectedColumnId(event.target.value)}
              >
                {visibleColumns.map((column) => (
                  <option value={column.id} key={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section className="task-board-columns" aria-label="Task board">
            {visibleColumns.map((column) => (
              <TaskBoardColumn
                key={column.id}
                column={column}
                active={column.id === activeColumn}
                project={project}
                tasks={tasks}
                quickCreateSwimlaneId={quickCreateSwimlaneId}
                onQuickCreateSwimlaneChange={setSelectedSwimlaneId}
                disabled={project.status === "archived"}
                onCreate={create}
                onOpen={openTask}
                onMove={(item, destination, lane, position) =>
                  void move(item, destination, lane, position)
                }
                onDropOnTask={dropOnTask}
                onDropOnLane={dropOnLane}
              />
            ))}
          </section>
        </>
      )}
      {detail && (
        <TaskDetails
          project={project}
          task={detail.task}
          trigger={detail.trigger}
          onClose={closeDetails}
          onChanged={changedTask}
          loading={detail.loading}
          loadError={detail.error}
          onRetry={retryTaskDetails}
        />
      )}
    </>
  );
}
