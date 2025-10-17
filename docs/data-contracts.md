# Network Simulation Data Contracts and State Flows

This document summarises the canonical domain models, API contracts, and state management flows introduced for the network topology simulation platform. The goal is to provide a shared source of truth for future feature work across the frontend and backend.

## Shared domain models

The `/src/shared` module exposes TypeScript types that describe the simulation domain.

### Core entities

| Entity | Description | Key Fields |
| --- | --- | --- |
| `Device` | Represents a node in the network topology | `id`, `name`, `role`, `interfaces`, `configuration`, `status`, `position` |
| `DeviceInterface` | Network interface on a device | `id`, `name`, `macAddress`, `ipv4`, `ipv6`, `status` |
| `Link` | Connection between two interfaces | `id`, `endpoints`, `bandwidthMbps`, `latencyMs`, `status` |
| `Packet` | Logical packet transmitted in the simulation | `id`, `source`, `destination`, `payloadType`, `sizeBytes`, `ttl`, `createdAt` |
| `SimulationState` | Aggregated state for a running or idle simulation | `status`, `currentTick`, `startedAt`, `stoppedAt`, `metrics`, `lastEventId` |
| `SimulationEvent` | Discrete event emitted by the simulation | Lifecycle events, packet events, interface status changes, topology updates, metrics snapshots |
| `Project` | Container for a topology and its simulation state | `id`, `name`, `description`, `topology`, `simulation`, `eventLog`, `tags`, `createdAt`, `updatedAt` |

The `SimulationEvent` union covers the following discriminated variants:

- `simulation.started`, `simulation.paused`, `simulation.resumed`, `simulation.stopped`
- `simulation.tick`
- `simulation.metrics`
- `packet.transmitted`
- `packet.dropped`
- `interface.state-changed`
- `topology.updated`

Associated helper utilities (`applySimulationEvent`, `normalizeProject`, etc.) live in `src/shared/simulation.ts` and are reused by both the backend and the frontend state store.

## Backend API surface

The Express server at `src/backend/server.ts` exposes REST endpoints and a WebSocket for realtime updates. All payloads reuse the shared types to keep the contracts aligned.

### REST endpoints

| Method | Path | Description | Request | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/projects` | List project summaries | – | `ProjectListResponse` (array of summaries) |
| `POST` | `/api/projects` | Create a project | `ProjectCreateRequest` | `ProjectResponse` |
| `GET` | `/api/projects/:projectId` | Fetch a project with full topology and simulation details | – | `ProjectResponse` |
| `PUT` | `/api/projects/:projectId` | Update project metadata, topology, or simulation state | `ProjectUpdateRequest` | `ProjectResponse` |
| `DELETE` | `/api/projects/:projectId` | Remove a project | – | `204 No Content` |
| `POST` | `/api/projects/:projectId/simulation/events` | Submit a simulation event to mutate state and broadcast | `SimulationEvent` (missing `id`/`timestamp` will be auto-hydrated) | `{ success: true }` |

Validation failures return `ApiErrorResponse` with an `error` message and optional `details` field.

### WebSocket channel

- URL: `ws://<host>/ws/simulation`
- All frames are JSON objects conforming to the `SimulationSocketMessage` type.

| Message Type | Payload |
| --- | --- |
| `projects.initial` | `Project[]` snapshot sent immediately on connection |
| `project.created` / `project.updated` / `project.deleted` | Delta updates for project lifecycle |
| `simulation.event` | A single `SimulationEvent` as it occurs |
| `pong` | `{ timestamp: string }` heartbeat reply for client `ping` frames |
| `error` | `{ message: string }` returned when the server cannot parse a client message |

Clients can optionally send `{ "type": "ping" }` frames to receive a `pong` response.

## Frontend state management

The Zustand-powered store (`src/frontend/state/networkStore.ts`) orchestrates UI state.

### Stored slices

- `projects`: Normalised map of `Project` objects keyed by `id`.
- `activeProjectId`: Currently focused project for editing or simulation playback.
- `eventLog`: Global rolling window (max `MAX_EVENT_LOG_ENTRIES`) of recent `SimulationEvent`s.
- `topologyDraft`: Optional working copy of the topology for UI editors.
- `selectedDeviceId` / `selectedLinkId`: Highlighted entities in the UI.
- `isSyncing`: Flag for network activity indicators.

### Core actions

| Action | Purpose |
| --- | --- |
| `setProjects(projects)` | Bulk replace the project map (e.g., initial load) while preserving selections when possible. |
| `upsertProject(project)` | Insert or replace a single project record; auto-select if nothing is active. |
| `removeProject(projectId)` | Delete a project and clean up related selections/events. |
| `setActiveProject(projectId)` | Switch the focused project. |
| `recordSimulationEvent(event)` | Apply a live event via `applySimulationEvent`, updating both the project and the global log. |
| `patchDevice(deviceId, patch)` / `patchLink(linkId, patch)` | Update topology elements for the active project. |
| `setTopologyDraft(draft)` / `setIsSyncing(flag)` | Manage UI-specific state. |
| `selectDevice(deviceId)` / `selectLink(linkId)` | Track UI selections with validation. |
| `reset()` | Clear the store to its initial state. |

All mutations share the same helper utilities as the backend to maintain deterministic updates across clients.

## Data flow summary

1. **Initial load**
   - Frontend calls `GET /api/projects` for summaries, then `GET /api/projects/:id` for full data as needed.
   - WebSocket connection opens and receives `projects.initial`, hydrating the store.

2. **Topology editing**
   - UI mutations operate on `topologyDraft` until the user saves.
   - Saving issues a `PUT /api/projects/:id` request; the backend broadcasts `project.updated` to other clients.

3. **Simulation runtime**
   - Backend (or an external simulator) posts events to `/api/projects/:id/simulation/events`.
   - Each event updates the in-memory store, then broadcasts `simulation.event` and `project.updated` for synchronisation.
   - Frontend calls `recordSimulationEvent` which reuses `applySimulationEvent` to mirror backend state.

4. **Deletion**
   - `DELETE /api/projects/:id` removes the record server-side. A `project.deleted` message prompts clients to clean up local state.

These contracts create a consistent foundation for upcoming features such as collaborative topology editing, visual playback of packet flows, or persisting data to an external database.
