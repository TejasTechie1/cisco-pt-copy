import { randomUUID } from 'crypto';

import {
  Project,
  ProjectCreateRequest,
  ProjectSummary,
  ProjectUpdateRequest,
  SimulationEvent,
  applySimulationEvent,
  createInitialPlaybackState,
  createInitialSimulationMetrics,
  ensurePlaybackState,
  ensureSimulationState,
  normalizeProject,
  normalizeProjects,
} from '../shared';

const createInitialProject = (payload: ProjectCreateRequest): Project => {
  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name: payload.name,
    description: payload.description,
    topology: payload.topology ?? { devices: [], links: [] },
    simulation: ensureSimulationState({
      status: 'idle',
      currentTick: 0,
      metrics: createInitialSimulationMetrics(),
    }),
    playback: createInitialPlaybackState(),
    scenarios: payload.scenarios ?? [],
    eventLog: [],
    createdAt: now,
    updatedAt: now,
    tags: payload.tags ?? [],
  };

  return normalizeProject(project);
};

const toSummary = (project: Project): ProjectSummary => ({
  id: project.id,
  name: project.name,
  description: project.description,
  simulationStatus: project.simulation.status,
  deviceCount: project.topology.devices.length,
  linkCount: project.topology.links.length,
  updatedAt: project.updatedAt,
});

export class InMemoryProjectStore {
  #projects = new Map<string, Project>();

  list(): Project[] {
    return Array.from(this.#projects.values()).map((project) => normalizeProject(project));
  }

  listSummaries(): ProjectSummary[] {
    return this.list().map(toSummary);
  }

  get(projectId: string): Project | undefined {
    const project = this.#projects.get(projectId);
    return project ? normalizeProject(project) : undefined;
  }

  create(payload: ProjectCreateRequest): Project {
    const project = createInitialProject(payload);
    this.#projects.set(project.id, project);
    return project;
  }

  update(projectId: string, payload: ProjectUpdateRequest): Project | undefined {
    const existing = this.#projects.get(projectId);
    if (!existing) {
      return undefined;
    }

    const updated: Project = normalizeProject({
      ...existing,
      name: payload.name ?? existing.name,
      description: payload.description ?? existing.description,
      topology: payload.topology ?? existing.topology,
      simulation: payload.simulation
        ? ensureSimulationState({
            ...existing.simulation,
            ...payload.simulation,
            metrics: payload.simulation.metrics ?? existing.simulation.metrics,
          })
        : existing.simulation,
      playback: payload.playback
        ? ensurePlaybackState({
            ...(existing.playback ?? createInitialPlaybackState()),
            ...payload.playback,
          })
        : existing.playback,
      scenarios: payload.scenarios ?? existing.scenarios,
      tags: payload.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    });

    this.#projects.set(projectId, updated);
    return updated;
  }

  delete(projectId: string): boolean {
    return this.#projects.delete(projectId);
  }

  recordEvent(projectId: string, event: SimulationEvent): Project | undefined {
    const existing = this.#projects.get(projectId);
    if (!existing) {
      return undefined;
    }

    const project = applySimulationEvent(existing, event);
    this.#projects.set(projectId, project);
    return project;
  }

  replaceAll(projects: Project[]): void {
    this.#projects = new Map(Object.entries(normalizeProjects(projects)));
  }
}
