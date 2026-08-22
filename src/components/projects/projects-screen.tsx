"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button, StatusBadge, Surface } from "@/components/ui/primitives";
import { FocusDialog } from "./focus-dialog";
import { apiRequest, type ProjectData } from "./project-api";
import { ProjectNavigation } from "./project-navigation";

type ProjectListResponse = { projects: ProjectData[] };

type Template = "personal" | "simple" | "blank";

function ProjectCard({
  project,
  onChanged,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
}: {
  project: ProjectData;
  onChanged: () => void;
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string>();
  const router = useRouter();

  async function lifecycleAction(action: "archive" | "restore") {
    setPending(true);
    setError(undefined);
    try {
      await apiRequest(`/api/projects/${project.id}/${action}`, { method: "POST", body: "{}" });
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save that change.");
    } finally {
      setPending(false);
    }
  }

  async function permanentlyDelete() {
    if (confirmation !== project.name) return;
    setPending(true);
    setError(undefined);
    try {
      await apiRequest(`/api/projects/${project.id}/permanent-delete`, {
        method: "POST",
        body: JSON.stringify({ confirmation }),
      });
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not delete that project.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="project-card ui-surface">
      <div className="project-card__heading">
        <div>
          <StatusBadge status={project.status === "active" ? "success" : "neutral"}>
            {project.status === "active" ? "Active" : "Archived"}
          </StatusBadge>
          <h3>{project.name}</h3>
        </div>
        <span
          className="project-card__count"
          aria-label={`${project.columnCount ?? 0} workflow columns`}
        >
          {project.columnCount ?? 0}
        </span>
      </div>
      <p className="project-card__description">
        {project.description || "A focused board ready for your next piece of work."}
      </p>
      <dl className="project-card__meta">
        <div>
          <dt>Workflow</dt>
          <dd>{project.columnCount ?? 0} columns</dd>
        </div>
        <div>
          <dt>History</dt>
          <dd>{project.status === "archived" ? "Retained" : "Live"}</dd>
        </div>
      </dl>
      <div className="project-card__actions">
        <Button href={`/projects/${project.id}`} variant="primary">
          Open board
        </Button>
        {project.status === "active" ? (
          <button
            className="ui-button ui-button--secondary"
            type="button"
            onClick={() => void lifecycleAction("archive")}
            disabled={pending}
          >
            Archive
          </button>
        ) : (
          <button
            className="ui-button ui-button--secondary"
            type="button"
            onClick={() => void lifecycleAction("restore")}
            disabled={pending}
          >
            Restore
          </button>
        )}
        {onMove && (
          <div className="project-order-actions" aria-label={`Reorder ${project.name}`}>
            <button
              className="text-button"
              type="button"
              onClick={() => onMove(-1)}
              disabled={pending || !canMoveUp}
            >
              Move up
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => onMove(1)}
              disabled={pending || !canMoveDown}
            >
              Move down
            </button>
          </div>
        )}
        <button
          className="text-button text-button--danger"
          type="button"
          onClick={() => {
            setDeleteOpen(true);
            setConfirmation("");
          }}
          disabled={pending}
        >
          Delete permanently
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {deleteOpen && (
        <FocusDialog
          className="destructive-confirm"
          labelledBy={`delete-${project.id}-title`}
          onClose={() => setDeleteOpen(false)}
        >
          <h4 id={`delete-${project.id}-title`}>Delete “{project.name}” permanently?</h4>
          <p>
            This removes the project and its retained history. This cannot be undone. Type the
            project name to continue.
          </p>
          <label className="field" htmlFor={`confirm-${project.id}`}>
            Project name
            <input
              id={`confirm-${project.id}`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="destructive-confirm__actions">
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
              onClick={() => void permanentlyDelete()}
            >
              Permanently delete
            </button>
          </div>
        </FocusDialog>
      )}
    </article>
  );
}

export function ProjectsScreen() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [pending, setPending] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [template, setTemplate] = useState<Template>("personal");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function loadProjects() {
    setPending(true);
    try {
      const payload = await apiRequest<ProjectListResponse>("/api/projects");
      setProjects(payload.projects);
      setError(undefined);
    } catch (caught) {
      const status = (caught as Error & { status?: number }).status;
      if (status === 401) {
        router.replace("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "We could not load your projects.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    let active = true;
    void apiRequest<ProjectListResponse>("/api/projects")
      .then((payload) => {
        if (!active) return;
        setProjects(payload.projects);
        setError(undefined);
      })
      .catch((caught) => {
        if (!active) return;
        const status = (caught as Error & { status?: number }).status;
        if (status === 401) {
          router.replace("/login");
          return;
        }
        setError(caught instanceof Error ? caught.message : "We could not load your projects.");
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function reorderProject(project: ProjectData, position: number) {
    try {
      await apiRequest(`/api/projects/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ projectId: project.id, position }),
      });
      await loadProjects();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not reorder that project.");
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const payload = await apiRequest<{ project: ProjectData }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description, template }),
      });
      router.push(`/projects/${payload.project.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not create that project.");
    } finally {
      setSaving(false);
    }
  }

  const active = projects.filter((project) => project.status === "active");
  const archived = projects.filter((project) => project.status === "archived");

  return (
    <div className="product-frame">
      <ProjectNavigation />
      <main className="product-main" aria-labelledby="projects-title">
        <header className="product-header">
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h1 id="projects-title">Projects</h1>
            <p className="product-lede">
              Open a board, shape the workflow, and keep the work surface calm.
            </p>
          </div>
          <Button
            onClick={() => {
              setCreateOpen(true);
              setName("");
              setDescription("");
              setError(undefined);
            }}
          >
            New project <span aria-hidden="true">＋</span>
          </Button>
        </header>
        {error && !createOpen && (
          <div className="inline-alert" role="alert">
            {error}{" "}
            <button className="text-button" type="button" onClick={() => void loadProjects()}>
              Try again
            </button>
          </div>
        )}
        {pending ? (
          <div className="loading-panel" role="status" aria-live="polite">
            Loading your projects…
          </div>
        ) : (
          <>
            <section className="project-section" aria-labelledby="active-projects-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Ready to open</p>
                  <h2 id="active-projects-title">Active projects</h2>
                </div>
                <span className="section-count">{active.length}</span>
              </div>
              {active.length > 0 ? (
                <div className="project-grid">
                  {active.map((project, index) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onChanged={() => void loadProjects()}
                      onMove={(direction) => void reorderProject(project, index + direction)}
                      canMoveUp={index > 0}
                      canMoveDown={index < active.length - 1}
                    />
                  ))}
                </div>
              ) : (
                <Surface className="empty-panel">
                  <h3>No active projects yet.</h3>
                  <p>Create a Personal Project, Simple board, or a Blank foundation to begin.</p>
                  <Button onClick={() => setCreateOpen(true)}>Create your first project</Button>
                </Surface>
              )}
            </section>
            {archived.length > 0 && (
              <section className="project-section" aria-labelledby="archived-projects-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Retained history</p>
                    <h2 id="archived-projects-title">Archived projects</h2>
                  </div>
                  <span className="section-count">{archived.length}</span>
                </div>
                <div className="project-grid">
                  {archived.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onChanged={() => void loadProjects()}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      {createOpen && (
        <div className="modal-backdrop" role="presentation">
          <FocusDialog
            className="product-dialog"
            labelledBy="create-project-title"
            onClose={() => setCreateOpen(false)}
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">New board</p>
                <h2 id="create-project-title">Create a project</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close create project dialog"
                onClick={() => setCreateOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="project-form" onSubmit={(event) => void createProject(event)}>
              <label className="field" htmlFor="project-name">
                Project name
                <input
                  id="project-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                />
              </label>
              <label className="field" htmlFor="project-description">
                Description <span className="field-optional">Optional</span>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={20000}
                  rows={3}
                />
              </label>
              <fieldset className="template-choices">
                <legend>Workflow template</legend>
                <label
                  className={
                    template === "personal" ? "template-choice selected" : "template-choice"
                  }
                >
                  <input
                    type="radio"
                    name="template"
                    value="personal"
                    checked={template === "personal"}
                    onChange={() => setTemplate("personal")}
                  />
                  <span>
                    <strong>Personal Project</strong>
                    <small>Backlog, Today, In Progress, Review, Done</small>
                  </span>
                </label>
                <label
                  className={template === "simple" ? "template-choice selected" : "template-choice"}
                >
                  <input
                    type="radio"
                    name="template"
                    value="simple"
                    checked={template === "simple"}
                    onChange={() => setTemplate("simple")}
                  />
                  <span>
                    <strong>Simple</strong>
                    <small>To Do, In Progress, Done</small>
                  </span>
                </label>
                <label
                  className={template === "blank" ? "template-choice selected" : "template-choice"}
                >
                  <input
                    type="radio"
                    name="template"
                    value="blank"
                    checked={template === "blank"}
                    onChange={() => setTemplate("blank")}
                  />
                  <span>
                    <strong>Blank</strong>
                    <small>Starts with valid In Progress and Done columns to customize.</small>
                  </span>
                </label>
              </fieldset>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="ui-button ui-button--secondary"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="ui-button ui-button--primary"
                  type="submit"
                  disabled={saving || name.trim().length === 0}
                >
                  {saving ? "Creating…" : "Create project"}
                </button>
              </div>
            </form>
          </FocusDialog>
        </div>
      )}
    </div>
  );
}
