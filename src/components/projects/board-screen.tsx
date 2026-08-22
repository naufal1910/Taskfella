"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import { Button, StatusBadge, Surface } from "@/components/ui/primitives";
import {
  apiRequest,
  type LabelData,
  type ProjectColumnData,
  type ProjectData,
  type SwimlaneData,
} from "./project-api";
import { FocusDialog } from "./focus-dialog";
import { ProjectNavigation } from "./project-navigation";

type ProjectResponse = {
  project: ProjectData & {
    columns: ProjectColumnData[];
    swimlanes: SwimlaneData[];
    labels: LabelData[];
  };
};

type Role = ProjectColumnData["role"];
type WipMode = ProjectColumnData["wipMode"];

const roles: Array<{ value: Role; label: string }> = [
  { value: "queued", label: "Queued" },
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
  { value: "neutral", label: "Neutral" },
];

function cloneColumns(columns: ProjectColumnData[]): ProjectColumnData[] {
  return columns.map((column, position) => ({ ...column, position }));
}

function WipBadge({ column }: { column: ProjectColumnData }) {
  if (column.wipMode === "none") return <span className="wip-badge">WIP none</span>;
  return (
    <span className={`wip-badge wip-badge--${column.wipMode}`}>
      WIP {column.wipMode} · 0/{column.wipLimit}
    </span>
  );
}

function BoardColumn({ column, headingId }: { column: ProjectColumnData; headingId: string }) {
  return (
    <article className="board-column" aria-labelledby={headingId}>
      <header className="board-column__header">
        <div>
          <p className="column-role">{column.role}</p>
          <h3 id={headingId}>{column.name}</h3>
        </div>
        <span className="column-count" aria-label="No tasks">
          0
        </span>
      </header>
      <div className="board-column__meta">
        <WipBadge column={column} />
        {column.role === "active" && <StatusBadge status="success">Focus destination</StatusBadge>}
        {column.role === "completed" && (
          <StatusBadge status="neutral">Completion meaning</StatusBadge>
        )}
      </div>
      <div className="board-empty" role="status">
        <span className="board-empty__mark" aria-hidden="true">
          ＋
        </span>
        <p>No tasks yet</p>
        <small>This workflow is ready for Phase 3 task execution.</small>
      </div>
    </article>
  );
}

function WorkflowEditor({
  project,
  onSaved,
}: {
  project: ProjectData & { columns: ProjectColumnData[] };
  onSaved: (project: ProjectData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ProjectColumnData[]>(cloneColumns(project.columns));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [confirmMeaning, setConfirmMeaning] = useState(false);
  const [newName, setNewName] = useState("");

  function update(id: string, patch: Partial<ProjectColumnData>) {
    setColumns((current) =>
      current.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    );
  }

  function move(id: string, direction: -1 | 1) {
    setColumns((current) => {
      const index = current.findIndex((column) => column.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((column, position) => ({ ...column, position }));
    });
  }

  async function save(confirmCompletionChanges = false) {
    setSaving(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${project.id}/workflow`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedRevision: project.revision,
          confirmCompletionChanges,
          columns: columns.map(
            ({ id, name, role, position, wipMode, wipLimit, completedGrouping }) => ({
              id,
              name,
              role,
              position,
              wipMode,
              wipLimit,
              completedGrouping,
            }),
          ),
        }),
      });
      setConfirmMeaning(false);
      setOpen(false);
      onSaved(response.project);
    } catch (caught) {
      if (
        (caught as Error & { code?: string }).code === "WORKFLOW_CONFIRMATION_REQUIRED" &&
        !confirmCompletionChanges
      ) {
        setConfirmMeaning(true);
      } else {
        setError(caught instanceof Error ? caught.message : "We could not save the workflow.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function addColumn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${project.id}/columns`, {
        method: "POST",
        body: JSON.stringify({ name: newName, role: "neutral" }),
      });
      setNewName("");
      onSaved(response.project);
      setColumns(cloneColumns(response.project.columns ?? []));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not add that column.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteColumn(column: ProjectColumnData) {
    if (!window.confirm(`Delete the empty column “${column.name}”?`)) return;
    setSaving(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(
        `/api/projects/${project.id}/columns/${column.id}`,
        { method: "DELETE", body: JSON.stringify({ expectedRevision: project.revision }) },
      );
      onSaved(response.project);
      setColumns(cloneColumns(response.project.columns ?? []));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete that column.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          setError(undefined);
          setConfirmMeaning(false);
        }}
      >
        Customize workflow
      </Button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <FocusDialog
            className="product-dialog product-dialog--wide"
            labelledBy="workflow-dialog-title"
            onClose={() => setOpen(false)}
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Board configuration</p>
                <h2 id="workflow-dialog-title">Shape the workflow</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close workflow dialog"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="dialog-copy">
              Roles define the future completion boundary. WIP is checked by the server when Phase 3
              work moves into a column.
            </p>
            <div className="workflow-editor">
              {columns.map((column, index) => (
                <fieldset className="workflow-row" key={column.id}>
                  <legend>Column {index + 1}</legend>
                  <div className="workflow-row__fields">
                    <label className="field">
                      Name
                      <input
                        value={column.name}
                        onChange={(event) => update(column.id, { name: event.target.value })}
                        maxLength={80}
                      />
                    </label>
                    <label className="field">
                      Semantic role
                      <select
                        value={column.role}
                        onChange={(event) =>
                          update(column.id, { role: event.target.value as Role })
                        }
                      >
                        {roles.map((role) => (
                          <option value={role.value} key={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      WIP mode
                      <select
                        value={column.wipMode}
                        onChange={(event) => {
                          const mode = event.target.value as WipMode;
                          update(column.id, {
                            wipMode: mode,
                            wipLimit: mode === "none" ? null : (column.wipLimit ?? 3),
                          });
                        }}
                      >
                        {["none", "warn", "enforce"].map((mode) => (
                          <option value={mode} key={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </label>
                    {column.wipMode !== "none" && (
                      <label className="field">
                        Limit
                        <input
                          type="number"
                          min={1}
                          max={1000000}
                          value={column.wipLimit ?? 3}
                          onChange={(event) =>
                            update(column.id, { wipLimit: Number(event.target.value) })
                          }
                        />
                      </label>
                    )}
                    <label className="field">
                      Completed view
                      <select
                        value={column.completedGrouping}
                        onChange={(event) =>
                          update(column.id, {
                            completedGrouping: event.target.value as "list" | "date",
                          })
                        }
                      >
                        <option value="list">Plain list</option>
                        <option value="date">Group by date</option>
                      </select>
                    </label>
                  </div>
                  <div className="workflow-row__actions">
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => move(column.id, -1)}
                      disabled={index === 0}
                    >
                      Move left
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => move(column.id, 1)}
                      disabled={index === columns.length - 1}
                    >
                      Move right
                    </button>
                    <button
                      className="text-button text-button--danger"
                      type="button"
                      onClick={() => void deleteColumn(column)}
                    >
                      Delete empty column
                    </button>
                  </div>
                </fieldset>
              ))}
            </div>
            <form className="inline-create" onSubmit={(event) => void addColumn(event)}>
              <label className="field" htmlFor="new-column-name">
                Add a column
                <input
                  id="new-column-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Waiting"
                />
              </label>
              <Button
                variant="secondary"
                type="submit"
                disabled={saving || newName.trim().length === 0}
              >
                Add column
              </Button>
            </form>
            {confirmMeaning && (
              <div className="confirmation-callout" role="alert">
                <strong>Confirm completion meaning</strong>
                <p>
                  One or more changes alter which workflow columns mean completed. Existing task
                  behavior will be reconciled at the Phase 3 task boundary.
                </p>
                <div className="dialog-actions">
                  <button
                    className="ui-button ui-button--secondary"
                    type="button"
                    onClick={() => setConfirmMeaning(false)}
                  >
                    Keep editing
                  </button>
                  <button
                    className="ui-button ui-button--primary"
                    type="button"
                    onClick={() => void save(true)}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Confirm and save"}
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                className="ui-button ui-button--secondary"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button--primary"
                type="button"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save workflow"}
              </button>
            </div>
          </FocusDialog>
        </div>
      )}
    </>
  );
}

function ProjectDetailsEditor({
  project,
  onSaved,
}: {
  project: ProjectData;
  onSaved: (project: ProjectData) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description, expectedRevision: project.revision }),
      });
      setOpen(false);
      onSaved(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save the project details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setName(project.name);
          setDescription(project.description);
          setError(undefined);
          setOpen(true);
        }}
      >
        Edit project
      </Button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <FocusDialog
            className="product-dialog"
            labelledBy="project-details-title"
            onClose={() => setOpen(false)}
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">Project details</p>
                <h2 id="project-details-title">Edit project</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close edit project dialog"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="project-form" onSubmit={(event) => void save(event)}>
              <label className="field" htmlFor="edit-project-name">
                Project name
                <input
                  id="edit-project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>
              <label className="field" htmlFor="edit-project-description">
                Description <span className="field-optional">Optional</span>
                <textarea
                  id="edit-project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  maxLength={20000}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="ui-button ui-button--secondary"
                  type="button"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="ui-button ui-button--primary"
                  type="submit"
                  disabled={saving || !name.trim()}
                >
                  {saving ? "Saving…" : "Save details"}
                </button>
              </div>
            </form>
          </FocusDialog>
        </div>
      )}
    </>
  );
}

function BoardLifecycle({
  project,
  onChanged,
}: {
  project: ProjectData;
  onChanged: (project: ProjectData) => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function action(action: "archive" | "restore") {
    setPending(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${project.id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      onChanged(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save that change.");
    } finally {
      setPending(false);
    }
  }

  async function destroy() {
    if (confirmation !== project.name) return;
    setPending(true);
    setError(undefined);
    try {
      await apiRequest(`/api/projects/${project.id}/permanent-delete`, {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      router.push("/projects");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete that project.");
      setPending(false);
    }
  }

  return (
    <div className="board-lifecycle">
      <button
        className="text-button"
        type="button"
        onClick={() => void action(project.status === "active" ? "archive" : "restore")}
        disabled={pending}
      >
        {project.status === "active" ? "Archive project" : "Restore project"}
      </button>
      <button
        className="text-button text-button--danger"
        type="button"
        onClick={() => {
          setDeleteOpen(true);
          setConfirmation("");
        }}
      >
        Delete permanently
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {deleteOpen && (
        <div className="modal-backdrop" role="presentation">
          <FocusDialog
            className="destructive-confirm"
            labelledBy="board-delete-title"
            onClose={() => setDeleteOpen(false)}
          >
            <h2 id="board-delete-title">Permanently delete this project?</h2>
            <p>
              Archived history and board configuration will be removed. Type{" "}
              <strong>{project.name}</strong> exactly to confirm.
            </p>
            <label className="field" htmlFor="board-delete-confirm">
              Project name
              <input
                id="board-delete-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="dialog-actions">
              <button
                className="ui-button ui-button--secondary"
                type="button"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button--destructive"
                type="button"
                disabled={confirmation !== project.name || pending}
                onClick={() => void destroy()}
              >
                Permanently delete
              </button>
            </div>
          </FocusDialog>
        </div>
      )}
    </div>
  );
}

function BoardExtras({
  project,
  onSaved,
}: {
  project: ProjectData & { swimlanes: SwimlaneData[]; labels: LabelData[] };
  onSaved: (project: ProjectData) => void;
}) {
  const [laneName, setLaneName] = useState("");
  const [labelName, setLabelName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(kind: "swimlanes" | "labels", value: string) {
    if (!value.trim()) return;
    setPending(true);
    setError(undefined);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${project.id}/${kind}`, {
        method: "POST",
        body: JSON.stringify({ name: value, expectedRevision: project.revision }),
      });
      onSaved(response.project);
      if (kind === "swimlanes") setLaneName("");
      else setLabelName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save that board setting.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="board-foundation-settings" aria-labelledby="board-foundation-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Optional structure</p>
          <h2 id="board-foundation-title">Swimlanes and labels</h2>
        </div>
      </div>
      <div className="foundation-setting-grid">
        <div>
          <h3>Swimlanes</h3>
          <p>Manual rows with no independent WIP limit.</p>
          <ul className="chip-list">
            {project.swimlanes.map((lane) => (
              <li key={lane.id}>{lane.name}</li>
            ))}
            {project.swimlanes.length === 0 && <li className="chip-list__empty">None yet</li>}
          </ul>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("swimlanes", laneName);
            }}
          >
            <label className="sr-only" htmlFor="new-swimlane">
              New swimlane
            </label>
            <input
              id="new-swimlane"
              value={laneName}
              onChange={(event) => setLaneName(event.target.value)}
              placeholder="New swimlane"
            />
            <button
              className="ui-button ui-button--secondary"
              type="submit"
              disabled={pending || !laneName.trim()}
            >
              Add
            </button>
          </form>
        </div>
        <div>
          <h3>Board labels</h3>
          <p>Labels belong to this board only.</p>
          <ul className="chip-list">
            {project.labels.map((label) => (
              <li key={label.id} style={{ borderColor: label.color }}>
                {label.name}
              </li>
            ))}
            {project.labels.length === 0 && <li className="chip-list__empty">None yet</li>}
          </ul>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit("labels", labelName);
            }}
          >
            <label className="sr-only" htmlFor="new-label">
              New label
            </label>
            <input
              id="new-label"
              value={labelName}
              onChange={(event) => setLabelName(event.target.value)}
              placeholder="New label"
            />
            <button
              className="ui-button ui-button--secondary"
              type="submit"
              disabled={pending || !labelName.trim()}
            >
              Add
            </button>
          </form>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function BoardScreen({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<
    ProjectData & { columns: ProjectColumnData[]; swimlanes: SwimlaneData[]; labels: LabelData[] }
  >();
  const [selectedColumnId, setSelectedColumnId] = useState<string>();
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function load() {
    setPending(true);
    try {
      const response = await apiRequest<ProjectResponse>(`/api/projects/${projectId}`);
      setProject(response.project);
      setSelectedColumnId((current) =>
        current && response.project.columns.some((column) => column.id === current)
          ? current
          : response.project.columns[0]?.id,
      );
      setError(undefined);
    } catch (caught) {
      const status = (caught as Error & { status?: number }).status;
      if (status === 401) {
        router.replace("/login");
        return;
      }
      if (status === 404) {
        router.replace("/projects");
        return;
      }
      setError(caught instanceof Error ? caught.message : "We could not load this board.");
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    let active = true;
    void apiRequest<ProjectResponse>(`/api/projects/${projectId}`)
      .then((response) => {
        if (!active) return;
        setProject(response.project);
        setSelectedColumnId((current) =>
          current && response.project.columns.some((column) => column.id === current)
            ? current
            : response.project.columns[0]?.id,
        );
        setError(undefined);
      })
      .catch((caught) => {
        if (!active) return;
        const status = (caught as Error & { status?: number }).status;
        if (status === 401) {
          router.replace("/login");
          return;
        }
        if (status === 404) {
          router.replace("/projects");
          return;
        }
        setError(caught instanceof Error ? caught.message : "We could not load this board.");
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, router]);

  const selected = useMemo(
    () => project?.columns.find((column) => column.id === selectedColumnId),
    [project, selectedColumnId],
  );
  if (pending)
    return (
      <div className="product-frame">
        <ProjectNavigation />
        <main className="product-main">
          <div className="loading-panel" role="status">
            Loading board…
          </div>
        </main>
      </div>
    );
  if (error || !project)
    return (
      <div className="product-frame">
        <ProjectNavigation />
        <main className="product-main">
          <div className="inline-alert" role="alert">
            {error ?? "We could not load this board."}{" "}
            <button className="text-button" type="button" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </main>
      </div>
    );

  return (
    <div className="product-frame">
      <ProjectNavigation projectName={project.name} />
      <main className="product-main product-main--board" aria-labelledby="board-title">
        <header className="board-header">
          <div className="board-header__context">
            <Link className="back-link" href="/projects">
              ← Projects
            </Link>
            <p className="eyebrow">
              {project.status === "archived" ? "Archived project" : "Project board"}
            </p>
            <h1 id="board-title">{project.name}</h1>
            {project.description && <p className="board-description">{project.description}</p>}
          </div>
          <div className="board-header__actions">
            <ProjectDetailsEditor
              project={project}
              onSaved={(next) => setProject(next as typeof project)}
            />
            <WorkflowEditor
              key={project.revision}
              project={project}
              onSaved={(next) => setProject(next as typeof project)}
            />
            <BoardLifecycle
              project={project}
              onChanged={(next) => setProject(next as typeof project)}
            />
          </div>
        </header>
        <div className="mobile-column-picker">
          <label className="field" htmlFor="mobile-column">
            Show column
            <select
              id="mobile-column"
              value={selectedColumnId ?? ""}
              onChange={(event) => setSelectedColumnId(event.target.value)}
            >
              {project.columns.map((column) => (
                <option value={column.id} key={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section className="board-surface" aria-label="Workflow board">
          <div
            className="board-columns board-columns--desktop"
            style={{ "--board-column-count": project.columns.length } as CSSProperties}
          >
            {project.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                headingId={`desktop-column-${column.id}`}
              />
            ))}
          </div>
          <div className="board-column board-column--mobile">
            {selected ? (
              <BoardColumn column={selected} headingId={`mobile-column-${selected.id}`} />
            ) : (
              <p>No workflow columns are available.</p>
            )}
          </div>
        </section>
        <BoardExtras project={project} onSaved={(next) => setProject(next as typeof project)} />
        <section className="board-history" aria-labelledby="history-title">
          <div>
            <p className="eyebrow">Retained lifecycle</p>
            <h2 id="history-title">Project history</h2>
          </div>
          <p>
            Archiving keeps this board and its lifecycle record available. Permanent deletion is
            separate and requires typed confirmation.
          </p>
          <ol>
            {project.lifecycle?.map((event) => (
              <li key={event.id}>
                <strong>{event.event}</strong>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
