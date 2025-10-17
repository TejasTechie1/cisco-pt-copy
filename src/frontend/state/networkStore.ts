import { create } from 'zustand';

import {
  Device,
  Link,
  NetworkTopology,
  Project,
  SimulationEvent,
  MAX_EVENT_LOG_ENTRIES,
  applySimulationEvent,
  normalizeProject,
  normalizeProjects,
} from '../../shared';

interface NetworkStoreState {
  projects: Record<string, Project>;
  activeProjectId: string | null;
  eventLog: SimulationEvent[];
  topologyDraft: NetworkTopology | null;
  isSyncing: boolean;
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (projectId: string | null) => void;
  upsertProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  recordSimulationEvent: (event: SimulationEvent) => void;
  setTopologyDraft: (draft: NetworkTopology | null) => void;
  setIsSyncing: (flag: boolean) => void;
  patchDevice: (deviceId: string, patch: Partial<Device>) => void;
  patchLink: (linkId: string, patch: Partial<Link>) => void;
  selectDevice: (deviceId: string | null) => void;
  selectLink: (linkId: string | null) => void;
  reset: () => void;
}

const selectIfExists = <T extends { id: string }>(items: T[], selectedId: string | null): string | null =>
  selectedId && items.some((item) => item.id === selectedId) ? selectedId : null;

const trimEvents = (events: SimulationEvent[]): SimulationEvent[] =>
  events.length > MAX_EVENT_LOG_ENTRIES ? events.slice(-MAX_EVENT_LOG_ENTRIES) : events;

export const useNetworkStore = create<NetworkStoreState>((set) => ({
  projects: {},
  activeProjectId: null,
  eventLog: [],
  topologyDraft: null,
  isSyncing: false,
  selectedDeviceId: null,
  selectedLinkId: null,

  setProjects: (projects) => {
    set((state) => {
      const normalized = normalizeProjects(projects);
      const activeProjectId =
        state.activeProjectId && normalized[state.activeProjectId]
          ? state.activeProjectId
          : projects[0]?.id ?? null;

      const activeProject = activeProjectId ? normalized[activeProjectId] : undefined;

      return {
        projects: normalized,
        activeProjectId,
        selectedDeviceId: activeProject ? selectIfExists(activeProject.topology.devices, state.selectedDeviceId) : null,
        selectedLinkId: activeProject ? selectIfExists(activeProject.topology.links, state.selectedLinkId) : null,
        eventLog: trimEvents(state.eventLog.filter((event) => Boolean(normalized[event.projectId]))),
      };
    });
  },

  setActiveProject: (projectId) => {
    set((state) => {
      if (projectId && !state.projects[projectId]) {
        return state;
      }
      return {
        activeProjectId: projectId,
        topologyDraft: projectId ? state.topologyDraft : null,
        selectedDeviceId: projectId ? state.selectedDeviceId : null,
        selectedLinkId: projectId ? state.selectedLinkId : null,
      };
    });
  },

  upsertProject: (project) => {
    set((state) => {
      const normalized = normalizeProject(project);
      const projects = { ...state.projects, [normalized.id]: normalized };
      return {
        projects,
        activeProjectId: state.activeProjectId ?? normalized.id,
      };
    });
  },

  removeProject: (projectId) => {
    set((state) => {
      if (!state.projects[projectId]) {
        return state;
      }

      const { [projectId]: _removed, ...rest } = state.projects;
      const remainingIds = Object.keys(rest);
      const activeProjectId = state.activeProjectId === projectId ? remainingIds[0] ?? null : state.activeProjectId;
      const activeProject = activeProjectId ? rest[activeProjectId] : undefined;

      return {
        projects: rest,
        activeProjectId,
        eventLog: state.eventLog.filter((event) => event.projectId !== projectId),
        selectedDeviceId: activeProject ? selectIfExists(activeProject.topology.devices, state.selectedDeviceId) : null,
        selectedLinkId: activeProject ? selectIfExists(activeProject.topology.links, state.selectedLinkId) : null,
        topologyDraft: activeProject ? state.topologyDraft : null,
      };
    });
  },

  recordSimulationEvent: (event) => {
    set((state) => {
      const project = state.projects[event.projectId];
      if (!project) {
        return state;
      }

      const updatedProject = applySimulationEvent(project, event);
      const eventLog = trimEvents([...state.eventLog, event]);

      return {
        projects: { ...state.projects, [event.projectId]: updatedProject },
        eventLog,
      };
    });
  },

  setTopologyDraft: (draft) => {
    set({ topologyDraft: draft });
  },

  setIsSyncing: (flag) => {
    set({ isSyncing: flag });
  },

  patchDevice: (deviceId, patch) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }

      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const devices = project.topology.devices.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              ...patch,
              interfaces: patch.interfaces ?? device.interfaces,
              configuration: {
                ...device.configuration,
                ...(patch.configuration ?? {}),
                capabilities: patch.configuration?.capabilities ?? device.configuration.capabilities,
              },
            }
          : device,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices,
        },
        updatedAt: new Date().toISOString(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  patchLink: (linkId, patch) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }

      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const links = project.topology.links.map((link) => (link.id === linkId ? { ...link, ...patch } : link));

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          links,
        },
        updatedAt: new Date().toISOString(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  selectDevice: (deviceId) => {
    set((state) => {
      if (!deviceId) {
        return { selectedDeviceId: null };
      }
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }
      const exists = project.topology.devices.some((device) => device.id === deviceId);
      return {
        selectedDeviceId: exists ? deviceId : state.selectedDeviceId,
      };
    });
  },

  selectLink: (linkId) => {
    set((state) => {
      if (!linkId) {
        return { selectedLinkId: null };
      }
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }
      const exists = project.topology.links.some((link) => link.id === linkId);
      return {
        selectedLinkId: exists ? linkId : state.selectedLinkId,
      };
    });
  },

  reset: () =>
    set({
      projects: {},
      activeProjectId: null,
      eventLog: [],
      topologyDraft: null,
      isSyncing: false,
      selectedDeviceId: null,
      selectedLinkId: null,
    }),
}));
