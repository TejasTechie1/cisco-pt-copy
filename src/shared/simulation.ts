import {
  NetworkTopology,
  Project,
  Scenario,
  SimulationEvent,
  SimulationMetrics,
  SimulationPlaybackState,
  SimulationState,
  TopologyLayer,
} from './types';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled simulation event: ${JSON.stringify(value)}`);
};

export const MAX_EVENT_LOG_ENTRIES = 500;

export const createInitialSimulationMetrics = (): SimulationMetrics => ({
  totalPackets: 0,
  droppedPackets: 0,
  averageLatencyMs: 0,
  throughputMbps: 0,
});

export const createDefaultTopologyLayers = (): TopologyLayer[] => [
  {
    id: 'layer-physical',
    name: 'Physical',
    type: 'physical',
    order: 0,
    visible: true,
    locked: false,
    color: '#0EA5E9',
  },
  {
    id: 'layer-logical',
    name: 'Logical',
    type: 'logical',
    order: 1,
    visible: true,
    locked: false,
    color: '#F97316',
  },
  {
    id: 'layer-security',
    name: 'Security',
    type: 'security',
    order: 2,
    visible: false,
    locked: false,
    color: '#10B981',
  },
  {
    id: 'layer-wireless',
    name: 'Wireless',
    type: 'wireless',
    order: 3,
    visible: false,
    locked: false,
    color: '#A855F7',
  },
];

const cloneLayers = (layers: TopologyLayer[]): TopologyLayer[] =>
  layers
    .map((layer, index) => ({
      ...layer,
      order: layer.order ?? index,
      visible: layer.visible ?? true,
      locked: layer.locked ?? false,
    }))
    .sort((a, b) => a.order - b.order);

export const normalizeTopology = (topology: NetworkTopology): NetworkTopology => {
  const devices = (topology.devices ?? []).map((device) => ({
    ...device,
    interfaces: (device.interfaces ?? []).map((iface) => ({ ...iface })),
  }));

  const links = (topology.links ?? []).map((link) => ({
    ...link,
    endpoints: [...link.endpoints] as [typeof link.endpoints[0], typeof link.endpoints[1]],
  }));

  const layersSource = topology.layers && topology.layers.length > 0 ? topology.layers : createDefaultTopologyLayers();
  const layers = cloneLayers(layersSource);

  const annotations = (topology.annotations ?? []).map((annotation) => ({
    ...annotation,
    position: { ...annotation.position },
    size: annotation.size ? { ...annotation.size } : undefined,
    metadata: annotation.metadata ? { ...annotation.metadata } : undefined,
  }));

  const views = (topology.views ?? []).map((view, index) => ({
    id: view.id ?? `view-${index}`,
    name: view.name ?? `View ${index + 1}`,
    description: view.description,
    zoom: view.zoom ?? 1,
    pan: view.pan ? { ...view.pan } : { x: 0, y: 0 },
    layerVisibility: view.layerVisibility ? { ...view.layerVisibility } : undefined,
  }));

  return {
    devices,
    links,
    layers,
    annotations,
    views,
    metadata: topology.metadata ? { ...topology.metadata } : undefined,
  };
};

export const createInitialPlaybackState = (): SimulationPlaybackState => ({
  isPlaying: false,
  speedMultiplier: 1,
  loop: false,
  cursorTick: 0,
  bookmarks: [],
});

export const ensurePlaybackState = (playback?: SimulationPlaybackState): SimulationPlaybackState => ({
  isPlaying: playback?.isPlaying ?? false,
  speedMultiplier:
    playback?.speedMultiplier && playback.speedMultiplier > 0 ? playback.speedMultiplier : 1,
  loop: playback?.loop ?? false,
  cursorEventId: playback?.cursorEventId,
  cursorTick: playback?.cursorTick ?? 0,
  bookmarks: playback?.bookmarks ? playback.bookmarks.map((bookmark) => ({ ...bookmark })) : [],
});

export const ensureSimulationState = (simulation?: SimulationState): SimulationState => ({
  status: simulation?.status ?? 'idle',
  currentTick: simulation?.currentTick ?? 0,
  startedAt: simulation?.startedAt,
  stoppedAt: simulation?.stoppedAt,
  lastEventId: simulation?.lastEventId,
  metrics: simulation?.metrics ?? createInitialSimulationMetrics(),
});

const normalizeScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  objectives: scenario.objectives?.map((objective) => ({ ...objective })) ?? [],
  topologySnapshot: normalizeTopology(scenario.topologySnapshot),
  createdAt: scenario.createdAt,
  updatedAt: scenario.updatedAt,
  tags: scenario.tags ?? [],
});

export const applySimulationEvent = (project: Project, event: SimulationEvent): Project => {
  const simulation = ensureSimulationState(project.simulation);
  const playback = ensurePlaybackState(project.playback);
  let updatedSimulation: SimulationState = { ...simulation, lastEventId: event.id };
  let updatedPlayback: SimulationPlaybackState = { ...playback, cursorEventId: event.id };
  let topology: NetworkTopology = normalizeTopology(project.topology);

  switch (event.type) {
    case 'simulation.started':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
        startedAt: event.timestamp,
        currentTick: 0,
      };
      updatedPlayback = {
        ...updatedPlayback,
        isPlaying: true,
        cursorTick: 0,
      };
      break;
    case 'simulation.resumed':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
      };
      updatedPlayback = {
        ...updatedPlayback,
        isPlaying: true,
      };
      break;
    case 'simulation.paused':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
      };
      updatedPlayback = {
        ...updatedPlayback,
        isPlaying: false,
      };
      break;
    case 'simulation.stopped':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
        stoppedAt: event.timestamp,
      };
      updatedPlayback = {
        ...updatedPlayback,
        isPlaying: false,
      };
      break;
    case 'simulation.tick':
      updatedSimulation = {
        ...updatedSimulation,
        currentTick: event.tick,
      };
      updatedPlayback = {
        ...updatedPlayback,
        cursorTick: event.tick,
      };
      break;
    case 'simulation.metrics':
      updatedSimulation = {
        ...updatedSimulation,
        metrics: event.metrics,
      };
      break;
    case 'interface.state-changed':
      topology = {
        ...topology,
        devices: topology.devices.map((device) =>
          device.id === event.deviceId
            ? {
                ...device,
                interfaces: device.interfaces.map((iface) =>
                  iface.id === event.interfaceId ? { ...iface, status: event.status } : iface,
                ),
              }
            : device,
        ),
      };
      break;
    case 'topology.updated':
      topology = normalizeTopology(event.topology);
      break;
    case 'packet.transmitted': {
      const metrics = updatedSimulation.metrics;
      const previousTotal = metrics.totalPackets;
      const nextTotal = previousTotal + 1;
      const nextAverage =
        previousTotal === 0
          ? event.latencyMs
          : (metrics.averageLatencyMs * previousTotal + event.latencyMs) / nextTotal;
      updatedSimulation = {
        ...updatedSimulation,
        metrics: {
          ...metrics,
          totalPackets: nextTotal,
          averageLatencyMs: nextAverage,
        },
      };
      break;
    }
    case 'packet.dropped': {
      const metrics = updatedSimulation.metrics;
      updatedSimulation = {
        ...updatedSimulation,
        metrics: {
          ...metrics,
          droppedPackets: metrics.droppedPackets + 1,
        },
      };
      break;
    }
    default:
      assertNever(event);
  }

  const eventLog = [...project.eventLog, event];
  const trimmedEventLog =
    eventLog.length > MAX_EVENT_LOG_ENTRIES ? eventLog.slice(-MAX_EVENT_LOG_ENTRIES) : eventLog;

  return {
    ...project,
    topology,
    simulation: updatedSimulation,
    playback: updatedPlayback,
    updatedAt: event.timestamp,
    eventLog: trimmedEventLog,
  };
};

export const normalizeProject = (project: Project): Project => {
  const safeEventLog = Array.isArray((project as { eventLog?: SimulationEvent[] }).eventLog)
    ? ((project as { eventLog?: SimulationEvent[] }).eventLog as SimulationEvent[])
    : [];

  return {
    ...project,
    topology: normalizeTopology(project.topology),
    simulation: ensureSimulationState(project.simulation),
    playback: ensurePlaybackState(project.playback),
    scenarios: project.scenarios?.map((scenario) => normalizeScenario(scenario)) ?? [],
    eventLog: safeEventLog.slice(-MAX_EVENT_LOG_ENTRIES),
  };
};

export const normalizeProjects = (projects: Project[]): Record<string, Project> =>
  projects.reduce<Record<string, Project>>((acc, project) => {
    const normalized = normalizeProject(project);
    acc[normalized.id] = normalized;
    return acc;
  }, {});
