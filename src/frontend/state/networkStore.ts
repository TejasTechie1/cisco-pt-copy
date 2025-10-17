import { create } from 'zustand';

import {
  CableProfile,
  CanvasAnnotation,
  Device,
  DeviceTemplate,
  Link,
  LinkEndpoint,
  NetworkTopology,
  Project,
  Scenario,
  ScenarioDifficulty,
  SimulationEvent,
  SimulationPlaybackState,
  TopologyLayer,
  WorkspaceMode,
  MAX_EVENT_LOG_ENTRIES,
  applySimulationEvent,
  createDefaultTopologyLayers,
  ensurePlaybackState,
  normalizeProject,
  normalizeProjects,
  normalizeTopology,
} from '../../shared';
import { CABLE_PROFILES, DEVICE_TEMPLATES, findCableProfile, findDeviceTemplate } from './catalog';

const randomId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const randomMac = (): string =>
  Array.from({ length: 6 }, () => Math.floor(Math.random() * 256)
    .toString(16)
    .padStart(2, '0')).join(':');

const nowIso = () => new Date().toISOString();

const ensureLayers = (layers?: TopologyLayer[]): TopologyLayer[] =>
  layers && layers.length > 0
    ? layers.map((layer, index) => ({
        ...layer,
        order: layer.order ?? index,
        visible: layer.visible ?? true,
        locked: layer.locked ?? false,
      }))
    : createDefaultTopologyLayers().map((layer) => ({ ...layer }));

const ensureAnnotations = (annotations?: CanvasAnnotation[]): CanvasAnnotation[] =>
  (annotations ?? []).map((annotation) => ({
    ...annotation,
    position: { ...annotation.position },
    size: annotation.size ? { ...annotation.size } : undefined,
    metadata: annotation.metadata ? { ...annotation.metadata } : undefined,
  }));

const buildUniqueDeviceName = (baseName: string, devices: Device[]): string => {
  if (!devices.some((device) => device.name === baseName)) {
    return baseName;
  }
  let index = 2;
  let candidate = `${baseName} ${index}`;
  while (devices.some((device) => device.name === candidate)) {
    index += 1;
    candidate = `${baseName} ${index}`;
  }
  return candidate;
};

const cloneTopology = (topology: NetworkTopology): NetworkTopology => normalizeTopology(topology);

const defaultCableProfileId = CABLE_PROFILES[0]?.id ?? 'cable-cat6';

interface ConnectionDraft {
  source: LinkEndpoint & { interfaceName: string };
  cableProfileId: string;
}

interface MultiSelection {
  deviceIds: string[];
  linkIds: string[];
}

interface ScenarioSeed {
  name: string;
  description?: string;
  difficulty: ScenarioDifficulty;
  tags?: string[];
  objectives: string[];
}

interface NetworkStoreState {
  projects: Record<string, Project>;
  deviceTemplates: DeviceTemplate[];
  cableProfiles: CableProfile[];
  activeProjectId: string | null;
  eventLog: SimulationEvent[];
  topologyDraft: NetworkTopology | null;
  workspaceMode: WorkspaceMode;
  connectionDraft: ConnectionDraft | null;
  multiSelect: MultiSelection;
  isSyncing: boolean;
  selectedDeviceId: string | null;
  selectedLinkId: string | null;
  activeScenarioId: string | null;
  inspectorDeviceId: string | null;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (projectId: string | null) => void;
  upsertProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  recordSimulationEvent: (event: SimulationEvent) => void;
  setTopologyDraft: (draft: NetworkTopology | null) => void;
  setIsSyncing: (flag: boolean) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  setMultiSelect: (selection: MultiSelection) => void;
  clearSelection: () => void;
  patchDevice: (deviceId: string, patch: Partial<Device>) => void;
  patchLink: (linkId: string, patch: Partial<Link>) => void;
  addDeviceFromTemplate: (templateId: string, position: { x: number; y: number }) => void;
  duplicateDevice: (deviceId: string, offset?: { x: number; y: number }) => void;
  removeDevice: (deviceId: string) => void;
  removeLink: (linkId: string) => void;
  beginConnection: (deviceId: string, interfaceId: string, cableProfileId?: string) => void;
  completeConnection: (deviceId: string, interfaceId: string) => void;
  cancelConnection: () => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  upsertLayer: (layer: TopologyLayer) => void;
  removeLayer: (layerId: string) => void;
  addAnnotation: (annotation: CanvasAnnotation) => void;
  updateAnnotation: (annotationId: string, patch: Partial<CanvasAnnotation>) => void;
  removeAnnotation: (annotationId: string) => void;
  alignSelection: (direction: 'horizontal' | 'vertical' | 'grid') => void;
  autoLayout: (layout: 'grid' | 'circle' | 'tree') => void;
  setPlaybackState: (patch: Partial<SimulationPlaybackState>) => void;
  addPlaybackBookmark: (label: string, eventId: string, tick?: number) => void;
  removePlaybackBookmark: (bookmarkId: string) => void;
  setActiveScenario: (scenarioId: string | null) => void;
  createScenarioFromActiveProject: (seed: ScenarioSeed) => void;
  updateScenario: (scenarioId: string, patch: Partial<Scenario>) => void;
  deleteScenario: (scenarioId: string) => void;
  applyScenario: (scenarioId: string) => void;
  selectDevice: (deviceId: string | null) => void;
  selectLink: (linkId: string | null) => void;
  reset: () => void;
}

const trimEvents = (events: SimulationEvent[]): SimulationEvent[] =>
  events.length > MAX_EVENT_LOG_ENTRIES ? events.slice(-MAX_EVENT_LOG_ENTRIES) : events;

const mapProjectsWithDefaults = (projects: Record<string, Project>): Record<string, Project> => {
  const entries = Object.entries(projects).map<[string, Project]>(([id, project]) => [
    id,
    {
      ...project,
      topology: {
        ...project.topology,
        devices: project.topology.devices ?? [],
        links: project.topology.links ?? [],
        layers: ensureLayers(project.topology.layers),
        annotations: ensureAnnotations(project.topology.annotations),
        views: project.topology.views ?? [],
      },
      scenarios: project.scenarios ?? [],
      playback: ensurePlaybackState(project.playback),
    },
  ]);
  return Object.fromEntries(entries);
};

export const useNetworkStore = create<NetworkStoreState>((set, get) => ({
  projects: {},
  deviceTemplates: DEVICE_TEMPLATES,
  cableProfiles: CABLE_PROFILES,
  activeProjectId: null,
  eventLog: [],
  topologyDraft: null,
  workspaceMode: 'select',
  connectionDraft: null,
  multiSelect: { deviceIds: [], linkIds: [] },
  isSyncing: false,
  selectedDeviceId: null,
  selectedLinkId: null,
  activeScenarioId: null,
  inspectorDeviceId: null,

  setProjects: (projects) => {
    set((state) => {
      const normalized = mapProjectsWithDefaults(normalizeProjects(projects));
      const activeProjectId =
        state.activeProjectId && normalized[state.activeProjectId]
          ? state.activeProjectId
          : projects[0]?.id ?? null;

      const activeProject = activeProjectId ? normalized[activeProjectId] : undefined;

      return {
        projects: normalized,
        activeProjectId,
        selectedDeviceId: activeProject?.topology.devices.some((d) => d.id === state.selectedDeviceId)
          ? state.selectedDeviceId
          : null,
        selectedLinkId: activeProject?.topology.links.some((l) => l.id === state.selectedLinkId)
          ? state.selectedLinkId
          : null,
        eventLog: trimEvents(state.eventLog.filter((event) => Boolean(normalized[event.projectId]))),
        activeScenarioId:
          activeProject?.scenarios?.some((scenario) => scenario.id === state.activeScenarioId)
            ? state.activeScenarioId
            : null,
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
        activeScenarioId: projectId ? state.activeScenarioId : null,
        connectionDraft: null,
        workspaceMode: projectId ? state.workspaceMode : 'select',
      };
    });
  },

  upsertProject: (project) => {
    set((state) => {
      const normalized = normalizeProject(project);
      const projects = mapProjectsWithDefaults({ ...state.projects, [normalized.id]: normalized });
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
        selectedDeviceId: activeProject?.topology.devices.some((device) => device.id === state.selectedDeviceId)
          ? state.selectedDeviceId
          : null,
        selectedLinkId: activeProject?.topology.links.some((link) => link.id === state.selectedLinkId)
          ? state.selectedLinkId
          : null,
        topologyDraft: activeProject ? state.topologyDraft : null,
        activeScenarioId: activeProject?.scenarios?.some((scenario) => scenario.id === state.activeScenarioId)
          ? state.activeScenarioId
          : null,
        connectionDraft: null,
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

  setWorkspaceMode: (mode) => {
    set({ workspaceMode: mode });
  },

  setMultiSelect: (selection) => {
    set({ multiSelect: selection });
  },

  clearSelection: () => {
    set({
      selectedDeviceId: null,
      selectedLinkId: null,
      multiSelect: { deviceIds: [], linkIds: [] },
    });
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
        updatedAt: nowIso(),
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
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  addDeviceFromTemplate: (templateId, position) => {
    set((state) => {
      const projectId = state.activeProjectId;
      const template = findDeviceTemplate(templateId);
      if (!projectId || !template) {
        return state;
      }

      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const uniqueName = buildUniqueDeviceName(template.label, project.topology.devices);

      const interfaces = template.interfaceBlueprints.map((blueprint, index) => ({
        id: `${randomId()}-${index}`,
        name: blueprint.name,
        macAddress: randomMac(),
        status: 'down' as const,
        metadata: {
          medium: blueprint.medium,
          speedMbps: blueprint.speedMbps,
          description: blueprint.description,
        },
      }));

      const newDevice: Device = {
        id: randomId(),
        name: uniqueName,
        role: template.role,
        interfaces,
        configuration: {
          ...template.defaultConfiguration,
          capabilities: [...template.defaultConfiguration.capabilities],
          properties: template.defaultConfiguration.properties
            ? { ...template.defaultConfiguration.properties }
            : undefined,
        },
        status: 'offline',
        position,
        notes: template.description,
      };

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices: [...project.topology.devices, newDevice],
          layers: ensureLayers(project.topology.layers),
          annotations: ensureAnnotations(project.topology.annotations),
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
        selectedDeviceId: newDevice.id,
        inspectorDeviceId: newDevice.id,
      };
    });
  },

  duplicateDevice: (deviceId, offset = { x: 48, y: 48 }) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const target = project.topology.devices.find((device) => device.id === deviceId);
      if (!target) {
        return state;
      }

      const duplicate: Device = {
        ...target,
        id: randomId(),
        name: buildUniqueDeviceName(`${target.name} Copy`, project.topology.devices),
        position: target.position
          ? { x: target.position.x + offset.x, y: target.position.y + offset.y }
          : undefined,
        interfaces: target.interfaces.map((iface, index) => ({
          ...iface,
          id: `${randomId()}-${index}`,
          macAddress: randomMac(),
        })),
        status: 'offline',
      };

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices: [...project.topology.devices, duplicate],
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
        selectedDeviceId: duplicate.id,
        inspectorDeviceId: duplicate.id,
      };
    });
  },

  removeDevice: (deviceId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }

      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const devices = project.topology.devices.filter((device) => device.id !== deviceId);
      const links = project.topology.links.filter(
        (link) => link.endpoints[0].deviceId !== deviceId && link.endpoints[1].deviceId !== deviceId,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices,
          links,
        },
        updatedAt: nowIso(),
      };

      const stillSelectedDevice = state.selectedDeviceId === deviceId ? null : state.selectedDeviceId;
      const stillSelectedLink =
        state.selectedLinkId && links.some((link) => link.id === state.selectedLinkId)
          ? state.selectedLinkId
          : null;

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
        selectedDeviceId: stillSelectedDevice,
        selectedLinkId: stillSelectedLink,
      };
    });
  },

  removeLink: (linkId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }

      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const links = project.topology.links.filter((link) => link.id !== linkId);

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          links,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
        selectedLinkId: state.selectedLinkId === linkId ? null : state.selectedLinkId,
      };
    });
  },

  beginConnection: (deviceId, interfaceId, cableProfileId) => {
    const state = get();
    const projectId = state.activeProjectId;
    if (!projectId) {
      return;
    }
    const project = state.projects[projectId];
    if (!project) {
      return;
    }

    const device = project.topology.devices.find((entry) => entry.id === deviceId);
    const iface = device?.interfaces.find((entry) => entry.id === interfaceId);
    if (!device || !iface) {
      return;
    }

    set({
      connectionDraft: {
        source: { deviceId, interfaceId, interfaceName: iface.name },
        cableProfileId: cableProfileId ?? state.connectionDraft?.cableProfileId ?? defaultCableProfileId,
      },
      workspaceMode: 'connect',
    });
  },

  completeConnection: (deviceId, interfaceId) => {
    const state = get();
    const projectId = state.activeProjectId;
    const draft = state.connectionDraft;
    if (!projectId || !draft) {
      return;
    }

    const project = state.projects[projectId];
    if (!project) {
      return;
    }

    const sourceDevice = project.topology.devices.find((device) => device.id === draft.source.deviceId);
    const targetDevice = project.topology.devices.find((device) => device.id === deviceId);
    if (!sourceDevice || !targetDevice) {
      return;
    }
    const sourceInterface = sourceDevice.interfaces.find((iface) => iface.id === draft.source.interfaceId);
    const targetInterface = targetDevice.interfaces.find((iface) => iface.id === interfaceId);
    if (!sourceInterface || !targetInterface) {
      return;
    }

    if (draft.source.deviceId === deviceId && draft.source.interfaceId === interfaceId) {
      set({ connectionDraft: null });
      return;
    }

    const profile = findCableProfile(draft.cableProfileId)
      ?? findCableProfile(defaultCableProfileId)
      ?? state.cableProfiles[0];

    const linkId = randomId();

    const newLink: Link = {
      id: linkId,
      label: profile?.name,
      endpoints: [
        { deviceId: draft.source.deviceId, interfaceId: draft.source.interfaceId },
        { deviceId, interfaceId },
      ],
      bandwidthMbps: profile?.bandwidthMbps ?? 1000,
      latencyMs: profile?.latencyMs ?? 1,
      status: 'down',
      metadata: profile
        ? {
            medium: profile.medium,
            color: profile.color,
            connectors: profile.connectors,
            profileId: profile.id,
          }
        : undefined,
    };

    const updatedProject: Project = {
      ...project,
      topology: {
        ...project.topology,
        links: [...project.topology.links, newLink],
      },
      updatedAt: nowIso(),
    };

    set({
      projects: { ...state.projects, [projectId]: updatedProject },
      connectionDraft: null,
      selectedLinkId: linkId,
      workspaceMode: 'select',
    });
  },

  cancelConnection: () => {
    set({ connectionDraft: null, workspaceMode: 'select' });
  },

  toggleLayerVisibility: (layerId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const layers = ensureLayers(project.topology.layers).map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          layers,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  toggleLayerLock: (layerId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const layers = ensureLayers(project.topology.layers).map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          layers,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  upsertLayer: (layer) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const layers = ensureLayers(project.topology.layers);
      const existingIndex = layers.findIndex((entry) => entry.id === layer.id);
      let nextLayers: TopologyLayer[];
      if (existingIndex >= 0) {
        nextLayers = layers.map((entry) => (entry.id === layer.id ? { ...entry, ...layer } : entry));
      } else {
        nextLayers = [...layers, { ...layer, order: layer.order ?? layers.length }];
      }

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          layers: nextLayers.sort((a, b) => a.order - b.order),
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  removeLayer: (layerId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const layers = ensureLayers(project.topology.layers).filter((layer) => layer.id !== layerId);
      const nextLayers = layers.length > 0 ? layers : createDefaultTopologyLayers();

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          layers: nextLayers,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  addAnnotation: (annotation) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const nextAnnotation: CanvasAnnotation = {
        ...annotation,
        id: annotation.id ?? randomId(),
      };

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          annotations: [...ensureAnnotations(project.topology.annotations), nextAnnotation],
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  updateAnnotation: (annotationId, patch) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const annotations = ensureAnnotations(project.topology.annotations).map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              ...patch,
              position: patch.position ? { ...patch.position } : annotation.position,
              size: patch.size ? { ...patch.size } : annotation.size,
            }
          : annotation,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          annotations,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  removeAnnotation: (annotationId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const annotations = ensureAnnotations(project.topology.annotations).filter(
        (annotation) => annotation.id !== annotationId,
      );

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          annotations,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  alignSelection: (direction) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const deviceIds = state.multiSelect.deviceIds;
      if (deviceIds.length < 2) {
        return state;
      }

      const devices = project.topology.devices.map((device) => {
        if (!device.position || !deviceIds.includes(device.id)) {
          return device;
        }
        return { ...device };
      });

      const selectedDevices = devices.filter(
        (device) => device.position && deviceIds.includes(device.id),
      ) as Array<Device & { position: { x: number; y: number } }>;
      if (selectedDevices.length < 2) {
        return state;
      }

      if (direction === 'horizontal') {
        const averageY =
          selectedDevices.reduce((sum, device) => sum + device.position.y, 0) /
          selectedDevices.length;
        selectedDevices.forEach((device) => {
          device.position = { ...device.position, y: averageY };
        });
      } else if (direction === 'vertical') {
        const averageX =
          selectedDevices.reduce((sum, device) => sum + device.position.x, 0) /
          selectedDevices.length;
        selectedDevices.forEach((device) => {
          device.position = { ...device.position, x: averageX };
        });
      } else {
        const columns = Math.ceil(Math.sqrt(selectedDevices.length));
        const spacing = 120;
        selectedDevices.forEach((device, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          device.position = {
            x: column * spacing,
            y: row * spacing,
          };
        });
      }

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  autoLayout: (layout) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const devices = project.topology.devices.map((device) => ({ ...device }));
      if (devices.length === 0) {
        return state;
      }

      if (layout === 'grid') {
        const columns = Math.ceil(Math.sqrt(devices.length));
        const spacing = 160;
        devices.forEach((device, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          device.position = {
            x: column * spacing,
            y: row * spacing,
          };
        });
      } else if (layout === 'circle') {
        const radius = 220;
        const angleStep = (2 * Math.PI) / devices.length;
        devices.forEach((device, index) => {
          device.position = {
            x: Math.cos(angleStep * index) * radius,
            y: Math.sin(angleStep * index) * radius,
          };
        });
      } else {
        const spacingY = 160;
        const spacingX = 200;
        devices.forEach((device, index) => {
          device.position = {
            x: (index % 2) * spacingX,
            y: Math.floor(index / 2) * spacingY,
          };
        });
      }

      const updatedProject: Project = {
        ...project,
        topology: {
          ...project.topology,
          devices,
        },
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  setPlaybackState: (patch) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const playback = ensurePlaybackState(project.playback);
      const updatedPlayback: SimulationPlaybackState = {
        ...playback,
        ...patch,
        bookmarks: patch.bookmarks ? [...patch.bookmarks] : playback.bookmarks,
      };

      const updatedProject: Project = {
        ...project,
        playback: updatedPlayback,
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  addPlaybackBookmark: (label, eventId, tick) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const playback = ensurePlaybackState(project.playback);
      const bookmark = {
        id: randomId(),
        label,
        eventId,
        tick: tick ?? playback.cursorTick ?? 0,
      };

      const updatedProject: Project = {
        ...project,
        playback: {
          ...playback,
          bookmarks: [...playback.bookmarks, bookmark],
        },
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  removePlaybackBookmark: (bookmarkId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project) {
        return state;
      }

      const playback = ensurePlaybackState(project.playback);
      const updatedProject: Project = {
        ...project,
        playback: {
          ...playback,
          bookmarks: playback.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
        },
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  setActiveScenario: (scenarioId) => {
    const projectId = get().activeProjectId;
    if (!projectId) {
      return;
    }
    const project = get().projects[projectId];
    if (!project) {
      return;
    }

    if (scenarioId && !project.scenarios?.some((scenario) => scenario.id === scenarioId)) {
      return;
    }

    set({ activeScenarioId: scenarioId });
  },

  createScenarioFromActiveProject: (seed) => {
    const state = get();
    const projectId = state.activeProjectId;
    if (!projectId) {
      return;
    }
    const project = state.projects[projectId];
    if (!project) {
      return;
    }

    const topologySnapshot = cloneTopology(project.topology);
    const scenario: Scenario = {
      id: randomId(),
      name: seed.name,
      description: seed.description,
      difficulty: seed.difficulty,
      tags: seed.tags ?? [],
      objectives: seed.objectives.map((description) => ({
        id: randomId(),
        description,
        completed: false,
      })),
      topologySnapshot,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const updatedProject: Project = {
      ...project,
      scenarios: [...(project.scenarios ?? []), scenario],
      updatedAt: nowIso(),
    };

    set({
      projects: { ...state.projects, [projectId]: updatedProject },
      activeScenarioId: scenario.id,
    });
  },

  updateScenario: (scenarioId, patch) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project || !project.scenarios) {
        return state;
      }

      const scenarios = project.scenarios.map((scenario) =>
        scenario.id === scenarioId
          ? {
              ...scenario,
              ...patch,
              objectives: patch.objectives ?? scenario.objectives,
              topologySnapshot: patch.topologySnapshot
                ? cloneTopology(patch.topologySnapshot)
                : scenario.topologySnapshot,
              updatedAt: nowIso(),
            }
          : scenario,
      );

      const updatedProject: Project = {
        ...project,
        scenarios,
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
      };
    });
  },

  deleteScenario: (scenarioId) => {
    set((state) => {
      const projectId = state.activeProjectId;
      if (!projectId) {
        return state;
      }
      const project = state.projects[projectId];
      if (!project || !project.scenarios) {
        return state;
      }

      const scenarios = project.scenarios.filter((scenario) => scenario.id !== scenarioId);

      const updatedProject: Project = {
        ...project,
        scenarios,
        updatedAt: nowIso(),
      };

      return {
        projects: { ...state.projects, [projectId]: updatedProject },
        activeScenarioId: state.activeScenarioId === scenarioId ? null : state.activeScenarioId,
      };
    });
  },

  applyScenario: (scenarioId) => {
    const state = get();
    const projectId = state.activeProjectId;
    if (!projectId) {
      return;
    }
    const project = state.projects[projectId];
    if (!project || !project.scenarios) {
      return;
    }

    const scenario = project.scenarios.find((entry) => entry.id === scenarioId);
    if (!scenario) {
      return;
    }

    const topology = cloneTopology(scenario.topologySnapshot);
    const updatedProject: Project = {
      ...project,
      topology,
      updatedAt: nowIso(),
    };

    set({
      projects: { ...state.projects, [projectId]: updatedProject },
      activeScenarioId: scenarioId,
      selectedDeviceId: null,
      selectedLinkId: null,
      multiSelect: { deviceIds: [], linkIds: [] },
    });
  },

  selectDevice: (deviceId) => {
    set((state) => {
      if (!deviceId) {
        return { selectedDeviceId: null, inspectorDeviceId: null };
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
        inspectorDeviceId: exists ? deviceId : state.inspectorDeviceId,
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
    set((state) => ({
      projects: {},
      activeProjectId: null,
      eventLog: [],
      topologyDraft: null,
      workspaceMode: 'select',
      connectionDraft: null,
      multiSelect: { deviceIds: [], linkIds: [] },
      isSyncing: false,
      selectedDeviceId: null,
      selectedLinkId: null,
      activeScenarioId: null,
      inspectorDeviceId: null,
      deviceTemplates: state.deviceTemplates,
      cableProfiles: state.cableProfiles,
    })),
}));
