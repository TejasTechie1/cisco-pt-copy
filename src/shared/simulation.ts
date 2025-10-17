import {
  NetworkTopology,
  Project,
  SimulationEvent,
  SimulationMetrics,
  SimulationState,
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

export const ensureSimulationState = (simulation?: SimulationState): SimulationState => ({
  status: simulation?.status ?? 'idle',
  currentTick: simulation?.currentTick ?? 0,
  startedAt: simulation?.startedAt,
  stoppedAt: simulation?.stoppedAt,
  lastEventId: simulation?.lastEventId,
  metrics: simulation?.metrics ?? createInitialSimulationMetrics(),
});

export const applySimulationEvent = (project: Project, event: SimulationEvent): Project => {
  const simulation = ensureSimulationState(project.simulation);
  let updatedSimulation: SimulationState = { ...simulation, lastEventId: event.id };
  let topology: NetworkTopology = project.topology;

  switch (event.type) {
    case 'simulation.started':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
        startedAt: event.timestamp,
        currentTick: 0,
      };
      break;
    case 'simulation.resumed':
    case 'simulation.paused':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
      };
      break;
    case 'simulation.stopped':
      updatedSimulation = {
        ...updatedSimulation,
        status: event.status,
        stoppedAt: event.timestamp,
      };
      break;
    case 'simulation.tick':
      updatedSimulation = {
        ...updatedSimulation,
        currentTick: event.tick,
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
      topology = event.topology;
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
    topology: {
      devices: project.topology.devices ?? [],
      links: project.topology.links ?? [],
      metadata: project.topology.metadata,
    },
    simulation: ensureSimulationState(project.simulation),
    eventLog: safeEventLog.slice(-MAX_EVENT_LOG_ENTRIES),
  };
};

export const normalizeProjects = (projects: Project[]): Record<string, Project> =>
  projects.reduce<Record<string, Project>>((acc, project) => {
    const normalized = normalizeProject(project);
    acc[normalized.id] = normalized;
    return acc;
  }, {});
