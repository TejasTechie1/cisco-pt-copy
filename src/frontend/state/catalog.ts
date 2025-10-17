import { CableProfile, DeviceTemplate, DeviceTemplateCategory } from '../../shared';

const toCapabilities = (...capabilities: DeviceTemplate['defaultConfiguration']['capabilities']) =>
  Array.from(new Set(capabilities));

const baseConfig = (
  vendor: string,
  model: string,
  capabilities: DeviceTemplate['defaultConfiguration']['capabilities'],
  properties?: Record<string, unknown>,
) => ({
  vendor,
  model,
  osVersion: '1.0.0',
  capabilities: toCapabilities(...capabilities),
  properties,
});

const blueprint = (
  name: string,
  medium: DeviceTemplate['interfaceBlueprints'][number]['medium'],
  speedMbps: number,
  description?: string,
) => ({ name, medium, speedMbps, description });

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  {
    id: 'tpl-core-router',
    label: 'Catalyst Core Router',
    role: 'router',
    category: 'routing-switching',
    icon: '🛰️',
    description: 'High-performance multi-layer router with MPLS and BGP capabilities.',
    interfaceBlueprints: [
      blueprint('GigabitEthernet0/0', 'ethernet', 1000, 'WAN uplink'),
      blueprint('GigabitEthernet0/1', 'ethernet', 1000),
      blueprint('GigabitEthernet0/2', 'ethernet', 1000),
      blueprint('GigabitEthernet0/3', 'ethernet', 1000),
      blueprint('TenGigabitEthernet1/0', 'fiber', 10000, 'Aggregation fiber uplink'),
      blueprint('TenGigabitEthernet1/1', 'fiber', 10000),
    ],
    defaultConfiguration: baseConfig('Cisco', 'C9800', ['routing', 'monitoring', 'vpn']),
    tags: ['mpls', 'bgp', 'enterprise'],
    recommendedLayers: ['physical', 'logical'],
  },
  {
    id: 'tpl-distribution-switch',
    label: 'Nexus Distribution Switch',
    role: 'switch',
    category: 'routing-switching',
    icon: '🧬',
    description: 'Layer 3 switch with stackable architecture and PoE support.',
    interfaceBlueprints: Array.from({ length: 12 }, (_, index) =>
      blueprint(`GigabitEthernet1/${index + 1}`, 'ethernet', 1000, index < 4 ? 'PoE+' : undefined),
    ).concat([
      blueprint('TenGigabitEthernet2/1', 'fiber', 10000, 'Uplink'),
      blueprint('TenGigabitEthernet2/2', 'fiber', 10000, 'Uplink'),
    ]),
    defaultConfiguration: baseConfig('Cisco', 'Nexus 9300', ['switching', 'monitoring']),
    tags: ['distribution', 'stackable', 'poe'],
    recommendedLayers: ['physical'],
  },
  {
    id: 'tpl-firewall',
    label: 'Secure Firewall',
    role: 'firewall',
    category: 'security',
    icon: '🛡️',
    description: 'Next-generation firewall with deep packet inspection and VPN termination.',
    interfaceBlueprints: [
      blueprint('Outside', 'ethernet', 1000),
      blueprint('Inside', 'ethernet', 1000),
      blueprint('DMZ', 'ethernet', 1000),
      blueprint('Management', 'ethernet', 1000, 'Out-of-band management'),
    ],
    defaultConfiguration: baseConfig('Cisco', 'Firepower 2110', ['firewall', 'nat', 'vpn', 'monitoring']),
    tags: ['security', 'vpn'],
    recommendedLayers: ['security'],
  },
  {
    id: 'tpl-wireless-controller',
    label: 'Wireless LAN Controller',
    role: 'wireless-controller',
    category: 'wireless',
    icon: '📡',
    description: 'Manages enterprise Wi-Fi deployments with advanced RF tuning.',
    interfaceBlueprints: [
      blueprint('Service Port', 'ethernet', 1000),
      blueprint('Distribution System', 'ethernet', 1000),
      blueprint('Wireless', 'wireless', 600, 'CAPWAP control'),
    ],
    defaultConfiguration: baseConfig('Cisco', '9800-CL', ['wireless', 'monitoring']),
    tags: ['wifi6', 'rf'],
    recommendedLayers: ['wireless'],
  },
  {
    id: 'tpl-edge-server',
    label: 'Edge Compute Server',
    role: 'host',
    category: 'end-devices',
    icon: '🖥️',
    description: 'Virtualisation-ready server for application hosting at the edge.',
    interfaceBlueprints: [
      blueprint('NIC1', 'ethernet', 1000),
      blueprint('NIC2', 'ethernet', 1000),
    ],
    defaultConfiguration: baseConfig('Dell', 'PowerEdge XE', ['monitoring'], {
      os: 'Ubuntu Server 22.04 LTS',
    }),
    tags: ['vm', 'application'],
    recommendedLayers: ['logical'],
  },
  {
    id: 'tpl-iot-gateway',
    label: 'IoT Gateway',
    role: 'iot-gateway',
    category: 'iot',
    icon: '🔗',
    description: 'Compact gateway bridging industrial sensors to IP networks.',
    interfaceBlueprints: [
      blueprint('ETH0', 'ethernet', 100),
      blueprint('Serial0', 'serial', 4, 'RS-485 field bus'),
      blueprint('LoRa', 'wireless', 0.2, 'Low power WAN'),
    ],
    defaultConfiguration: baseConfig('Cisco', 'IXM IR1101', ['routing', 'monitoring']),
    tags: ['iot', 'edge'],
    recommendedLayers: ['physical', 'logical'],
  },
  {
    id: 'tpl-client-laptop',
    label: 'Field Engineer Laptop',
    role: 'host',
    category: 'end-devices',
    icon: '💻',
    description: 'Portable workstation with dual-band Wi-Fi and USB-C docking.',
    interfaceBlueprints: [
      blueprint('WiFi', 'wireless', 600),
      blueprint('USB-C Ethernet', 'ethernet', 1000),
    ],
    defaultConfiguration: baseConfig('Lenovo', 'ThinkPad X1', ['monitoring'], {
      os: 'Windows 11 Pro',
    }),
    tags: ['client', 'portable'],
    recommendedLayers: ['logical'],
  },
];

export const CABLE_PROFILES: CableProfile[] = [
  {
    id: 'cable-cat6',
    name: 'Cat6 Copper Patch',
    medium: 'copper',
    color: '#2563EB',
    bandwidthMbps: 1000,
    latencyMs: 1,
    connectors: ['RJ45'],
    maxDistanceMeters: 100,
    description: 'Shielded twisted pair ideal for access layer links.',
  },
  {
    id: 'cable-cat6a',
    name: 'Cat6a Copper',
    medium: 'copper',
    color: '#F59E0B',
    bandwidthMbps: 10000,
    latencyMs: 1,
    connectors: ['RJ45'],
    maxDistanceMeters: 100,
    description: 'Augmented copper for high-throughput PoE devices.',
  },
  {
    id: 'cable-sfp+',
    name: 'Single-mode Fiber (SFP+)',
    medium: 'fiber',
    color: '#10B981',
    bandwidthMbps: 10000,
    latencyMs: 0.3,
    connectors: ['LC'],
    maxDistanceMeters: 10000,
    description: 'Long-range fiber uplink suitable for distribution to core.',
  },
  {
    id: 'cable-qsfp',
    name: '40G QSFP Fiber',
    medium: 'fiber',
    color: '#8B5CF6',
    bandwidthMbps: 40000,
    latencyMs: 0.2,
    connectors: ['QSFP'],
    maxDistanceMeters: 150,
    description: 'High-throughput aggregation fabric link.',
  },
  {
    id: 'cable-serial-dce',
    name: 'Serial DCE',
    medium: 'serial',
    color: '#DC2626',
    bandwidthMbps: 2,
    latencyMs: 3,
    connectors: ['DB60'],
    maxDistanceMeters: 50,
    description: 'Legacy WAN serial connection for lab scenarios.',
  },
  {
    id: 'cable-wireless-link',
    name: 'Wireless Bridge',
    medium: 'wireless',
    color: '#F472B6',
    bandwidthMbps: 867,
    latencyMs: 4,
    connectors: ['802.11ac'],
    description: 'Point-to-point wireless link for temporary deployments.',
  },
];

export const findDeviceTemplate = (templateId: string): DeviceTemplate | undefined =>
  DEVICE_TEMPLATES.find((template) => template.id === templateId);

export const findCableProfile = (profileId: string): CableProfile | undefined =>
  CABLE_PROFILES.find((profile) => profile.id === profileId);

export const deviceCategories = (): Record<DeviceTemplateCategory, DeviceTemplate[]> =>
  DEVICE_TEMPLATES.reduce<Record<DeviceTemplateCategory, DeviceTemplate[]>>((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {
    'routing-switching': [],
    security: [],
    'end-devices': [],
    wireless: [],
    wan: [],
    iot: [],
    custom: [],
  });
