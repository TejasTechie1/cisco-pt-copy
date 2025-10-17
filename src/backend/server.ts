import cors from 'cors';
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';

import {
  ApiErrorResponse,
  ProjectCreateRequest,
  ProjectListResponse,
  ProjectResponse,
  ProjectUpdateRequest,
  SimulationEvent,
  SimulationSocketMessage,
} from '../shared';
import { InMemoryProjectStore } from './projectStore';

const app = express();
const projectStore = new InMemoryProjectStore();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

type AsyncRouteHandler = (req: Request, res: Response) => Promise<void> | void;

const withErrorHandling = (handler: AsyncRouteHandler): AsyncRouteHandler => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      const response: ApiErrorResponse = { error: 'Internal Server Error', details: message };
      res.status(500).json(response);
    }
  };
};

const validateProjectCreate = (payload: ProjectCreateRequest | undefined): payload is ProjectCreateRequest => {
  if (!payload) {
    return false;
  }

  if (!payload.name?.trim()) {
    return false;
  }

  if (!payload.topology) {
    return false;
  }

  return true;
};

const validateSimulationEvent = (event: SimulationEvent): string | null => {
  switch (event.type) {
    case 'simulation.started':
    case 'simulation.paused':
    case 'simulation.resumed':
    case 'simulation.stopped':
      return event.status ? null : 'status field is required for simulation lifecycle events';
    case 'simulation.tick':
      return typeof event.tick === 'number' ? null : 'tick field is required for simulation.tick events';
    case 'simulation.metrics':
      return event.metrics ? null : 'metrics field is required for simulation.metrics events';
    case 'packet.transmitted':
      if (!event.packet) {
        return 'packet field is required for packet.transmitted events';
      }
      if (!event.linkId) {
        return 'linkId field is required for packet.transmitted events';
      }
      return null;
    case 'packet.dropped':
      if (!event.packet) {
        return 'packet field is required for packet.dropped events';
      }
      if (!event.reason) {
        return 'reason field is required for packet.dropped events';
      }
      return null;
    case 'interface.state-changed':
      if (!event.deviceId || !event.interfaceId) {
        return 'deviceId and interfaceId are required for interface.state-changed events';
      }
      return event.status ? null : 'status field is required for interface.state-changed events';
    case 'topology.updated':
      return event.topology ? null : 'topology field is required for topology.updated events';
    default:
      return 'Unsupported simulation event type';
  }
};

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws/simulation' });

const broadcast = (message: SimulationSocketMessage) => {
  const encoded = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  });
};

app.get(
  '/api/projects',
  withErrorHandling((_req, res) => {
    const projects = projectStore.listSummaries();
    res.json(projects satisfies ProjectListResponse);
  }),
);

app.post(
  '/api/projects',
  withErrorHandling((req, res) => {
    const payload = req.body as ProjectCreateRequest | undefined;
    if (!validateProjectCreate(payload)) {
      const response: ApiErrorResponse = { error: 'Invalid request payload', details: 'name and topology are required' };
      res.status(400).json(response);
      return;
    }

    const project = projectStore.create(payload);
    broadcast({ type: 'project.created', payload: project });
    res.status(201).json(project satisfies ProjectResponse);
  }),
);

app.get(
  '/api/projects/:projectId',
  withErrorHandling((req, res) => {
    const { projectId } = req.params;
    const project = projectStore.get(projectId);
    if (!project) {
      const response: ApiErrorResponse = { error: 'Project not found' };
      res.status(404).json(response);
      return;
    }

    res.json(project satisfies ProjectResponse);
  }),
);

app.put(
  '/api/projects/:projectId',
  withErrorHandling((req, res) => {
    const { projectId } = req.params;
    const payload = req.body as ProjectUpdateRequest | undefined;
    if (!payload) {
      const response: ApiErrorResponse = { error: 'Invalid request payload' };
      res.status(400).json(response);
      return;
    }

    const project = projectStore.update(projectId, payload);
    if (!project) {
      const response: ApiErrorResponse = { error: 'Project not found' };
      res.status(404).json(response);
      return;
    }

    broadcast({ type: 'project.updated', payload: project });
    res.json(project satisfies ProjectResponse);
  }),
);

app.delete(
  '/api/projects/:projectId',
  withErrorHandling((req, res) => {
    const { projectId } = req.params;
    const deleted = projectStore.delete(projectId);
    if (!deleted) {
      const response: ApiErrorResponse = { error: 'Project not found' };
      res.status(404).json(response);
      return;
    }

    broadcast({ type: 'project.deleted', payload: { projectId } });
    res.status(204).send();
  }),
);

app.post(
  '/api/projects/:projectId/simulation/events',
  withErrorHandling((req, res) => {
    const { projectId } = req.params;
    const incoming = req.body as Partial<SimulationEvent> | undefined;

    if (!incoming || typeof incoming.type !== 'string') {
      const response: ApiErrorResponse = { error: 'Invalid simulation event payload' };
      res.status(400).json(response);
      return;
    }

    const hydratedEvent: SimulationEvent = {
      ...(incoming as SimulationEvent),
      id: incoming.id ?? randomUUID(),
      projectId,
      timestamp: incoming.timestamp ?? new Date().toISOString(),
    };

    const validationError = validateSimulationEvent(hydratedEvent);
    if (validationError) {
      const response: ApiErrorResponse = { error: 'Invalid simulation event', details: validationError };
      res.status(400).json(response);
      return;
    }

    const project = projectStore.recordEvent(projectId, hydratedEvent);
    if (!project) {
      const response: ApiErrorResponse = { error: 'Project not found' };
      res.status(404).json(response);
      return;
    }

    broadcast({ type: 'simulation.event', payload: hydratedEvent });
    broadcast({ type: 'project.updated', payload: project });

    res.status(202).json({ success: true });
  }),
);

wss.on('connection', (socket) => {
  const message: SimulationSocketMessage = {
    type: 'projects.initial',
    payload: projectStore.list(),
  };
  socket.send(JSON.stringify(message));

  socket.on('message', (buffer) => {
    try {
      const parsed = JSON.parse(buffer.toString());
      if (parsed?.type === 'ping') {
        const reply: SimulationSocketMessage = {
          type: 'pong',
          payload: { timestamp: new Date().toISOString() },
        };
        socket.send(JSON.stringify(reply));
      }
    } catch {
      const errorMessage: SimulationSocketMessage = {
        type: 'error',
        payload: { message: 'Invalid message payload' },
      };
      socket.send(JSON.stringify(errorMessage));
    }
  });
});

const PORT = Number(process.env.PORT ?? 4000);

export const startServer = (): void => {
  httpServer.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}
