export type DeviceRole =
  | 'router'
  | 'switch'
  | 'host'
  | 'firewall'
  | 'load-balancer'
  | 'custom';

export type InterfaceStatus = 'up' | 'down' | 'testing';

export interface DeviceInterface {
  id: string;
  name: string;
  macAddress: string;
  ipv4?: string;
  ipv6?: string;
  status: InterfaceStatus;
  metadata?: Record<string, unknown>;
}

export type DeviceCapability =
  | 'routing'
  | 'switching'
  | 'nat'
  | 'firewall'
  | 'load-balancing'
  | 'monitoring'
  | 'custom';

export interface DeviceConfiguration {
  vendor?: string;
  model?: string;
  osVersion?: string;
  capabilities: DeviceCapability[];
  properties?: Record<string, unknown>;
}

export interface Device {
  id: string;
  name: string;
  role: DeviceRole;
  interfaces: DeviceInterface[];
  configuration: DeviceConfiguration;
  status: 'online' | 'offline' | 'degraded';
  position?: { x: number; y: number };
  notes?: string;
}

export interface LinkEndpoint {
  deviceId: string;
  interfaceId: string;
}

export type LinkStatus = 'up' | 'down' | 'degraded';

export interface Link {
  id: string;
  label?: string;
  endpoints: [LinkEndpoint, LinkEndpoint];
  bandwidthMbps: number;
  latencyMs: number;
  status: LinkStatus;
  metadata?: Record<string, unknown>;
}

export interface NetworkTopology {
  devices: Device[];
  links: Link[];
  metadata?: Record<string, unknown>;
}

export interface Packet {
  id: string;
  source: LinkEndpoint;
  destination: LinkEndpoint;
  payloadType: 'data' | 'control' | 'heartbeat' | 'custom';
  sizeBytes: number;
  ttl: number;
  payload: unknown;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface SimulationMetrics {
  totalPackets: number;
  droppedPackets: number;
  averageLatencyMs: number;
  throughputMbps: number;
}

export interface SimulationState {
  status: SimulationStatus;
  currentTick: number;
  startedAt?: string;
  stoppedAt?: string;
  lastEventId?: string;
  metrics: SimulationMetrics;
}

export interface SimulationEventBase {
  id: string;
  projectId: string;
  timestamp: string;
}

export type SimulationEvent =
  | (SimulationEventBase & {
      type: 'simulation.started' | 'simulation.paused' | 'simulation.resumed' | 'simulation.stopped';
      status: SimulationStatus;
    })
  | (SimulationEventBase & {
      type: 'simulation.tick';
      tick: number;
    })
  | (SimulationEventBase & {
      type: 'packet.transmitted';
      packet: Packet;
      linkId: string;
      latencyMs: number;
    })
  | (SimulationEventBase & {
      type: 'packet.dropped';
      packet: Packet;
      linkId?: string;
      reason: string;
    })
  | (SimulationEventBase & {
      type: 'interface.state-changed';
      deviceId: string;
      interfaceId: string;
      status: InterfaceStatus;
    })
  | (SimulationEventBase & {
      type: 'topology.updated';
      topology: NetworkTopology;
      description?: string;
    })
  | (SimulationEventBase & {
      type: 'simulation.metrics';
      metrics: SimulationMetrics;
    });

export interface Project {
  id: string;
  name: string;
  description?: string;
  topology: NetworkTopology;
  simulation: SimulationState;
  eventLog: SimulationEvent[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  simulationStatus: SimulationStatus;
  deviceCount: number;
  linkCount: number;
  updatedAt: string;
}

export interface ProjectCreateRequest {
  name: string;
  description?: string;
  topology: NetworkTopology;
  tags?: string[];
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  topology?: NetworkTopology;
  simulation?: Partial<SimulationState>;
  tags?: string[];
}

export type ProjectResponse = Project;

export type ProjectListResponse = ProjectSummary[];

export interface ApiErrorResponse {
  error: string;
  details?: string;
}

export type SimulationSocketMessage =
  | { type: 'projects.initial'; payload: Project[] }
  | { type: 'project.created'; payload: Project }
  | { type: 'project.updated'; payload: Project }
  | { type: 'project.deleted'; payload: { projectId: string } }
  | { type: 'simulation.event'; payload: SimulationEvent }
  | { type: 'pong'; payload: { timestamp: string } }
  | { type: 'error'; payload: { message: string } };
