export type DeviceRole =
  | 'router'
  | 'switch'
  | 'host'
  | 'firewall'
  | 'load-balancer'
  | 'wireless-controller'
  | 'iot-gateway'
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
  | 'wireless'
  | 'vpn'
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

export interface DeviceInterfaceBlueprint {
  name: string;
  medium: 'ethernet' | 'fiber' | 'serial' | 'wireless' | 'loopback';
  speedMbps: number;
  description?: string;
}

export type DeviceTemplateCategory =
  | 'routing-switching'
  | 'security'
  | 'end-devices'
  | 'wireless'
  | 'wan'
  | 'iot'
  | 'custom';

export interface DeviceTemplate {
  id: string;
  label: string;
  role: DeviceRole;
  category: DeviceTemplateCategory;
  icon: string;
  description: string;
  interfaceBlueprints: DeviceInterfaceBlueprint[];
  defaultConfiguration: DeviceConfiguration;
  tags?: string[];
  recommendedLayers?: TopologyLayerType[];
}

export type CableMedium = 'copper' | 'fiber' | 'serial' | 'wireless';

export interface CableProfile {
  id: string;
  name: string;
  medium: CableMedium;
  color: string;
  bandwidthMbps: number;
  latencyMs: number;
  connectors: string[];
  maxDistanceMeters?: number;
  description?: string;
  metadata?: Record<string, unknown>;
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

export type TopologyLayerType = 'physical' | 'logical' | 'security' | 'wireless' | 'custom';

export interface TopologyLayer {
  id: string;
  name: string;
  type: TopologyLayerType;
  order: number;
  visible: boolean;
  locked: boolean;
  color?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export type CanvasAnnotationType = 'text' | 'zone' | 'shape' | 'image' | 'path';

export interface CanvasAnnotation {
  id: string;
  type: CanvasAnnotationType;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  rotationDeg?: number;
  text?: string;
  color?: string;
  background?: string;
  metadata?: Record<string, unknown>;
}

export interface TopologyView {
  id: string;
  name: string;
  description?: string;
  zoom: number;
  pan: { x: number; y: number };
  layerVisibility?: Record<string, boolean>;
}

export interface NetworkTopology {
  devices: Device[];
  links: Link[];
  layers?: TopologyLayer[];
  annotations?: CanvasAnnotation[];
  views?: TopologyView[];
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

export type WorkspaceMode = 'select' | 'pan' | 'connect' | 'inspect' | 'annotate' | 'simulate' | 'measure';

export interface PlaybackBookmark {
  id: string;
  label: string;
  eventId: string;
  tick: number;
}

export interface SimulationPlaybackState {
  isPlaying: boolean;
  speedMultiplier: number;
  loop: boolean;
  cursorEventId?: string;
  cursorTick?: number;
  bookmarks: PlaybackBookmark[];
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

export type ScenarioDifficulty = 'introductory' | 'intermediate' | 'advanced';

export interface ScenarioObjective {
  id: string;
  description: string;
  completed: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  difficulty: ScenarioDifficulty;
  objectives: ScenarioObjective[];
  topologySnapshot: NetworkTopology;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  topology: NetworkTopology;
  simulation: SimulationState;
  eventLog: SimulationEvent[];
  scenarios?: Scenario[];
  playback?: SimulationPlaybackState;
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
  scenarios?: Scenario[];
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  topology?: NetworkTopology;
  simulation?: Partial<SimulationState>;
  playback?: Partial<SimulationPlaybackState>;
  scenarios?: Scenario[];
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
