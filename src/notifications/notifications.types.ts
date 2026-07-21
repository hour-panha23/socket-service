import { DefaultEventsMap, Socket } from 'socket.io';
import { CustomSocketData } from './notifications.gateway';

export interface ServerToClientEvents {
  notification: (payload: Record<string, unknown>) => void;
  room_joined: (response: { status: string; roomId: string }) => void;
}

export interface ClientToServerEvents {
  join_room: (data: {
    projectId: string;
    appId: string;
    roomId: string;
  }) => void;
  leave_room: (data: {
    projectId: string;
    appId: string;
    roomId: string;
  }) => void;
}

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  CustomSocketData
>;
