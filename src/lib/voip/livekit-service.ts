/**
 * LiveKit Service - Room management and token generation
 * Lazy-init pattern to avoid build-time crashes (KB-PP-BUILD-002)
 */

import { logger } from '@/lib/logger';

// Lazy-loaded SDK instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _roomService: any = null;

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit not configured: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET required');
  }

  return { url, apiKey, apiSecret };
}

async function getRoomServiceClient() {
  if (_roomService) return _roomService;

  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const { RoomServiceClient } = await import('livekit-server-sdk');
  _roomService = new RoomServiceClient(url, apiKey, apiSecret);
  return _roomService;
}

// ─── Token Generation ──────────────────────────────────────────────────────

export async function generateToken(
  roomName: string,
  identity: string,
  options?: {
    name?: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    isAdmin?: boolean;
  }
): Promise<string> {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const { AccessToken } = await import('livekit-server-sdk');

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: options?.name || identity,
    ttl: '6h',
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: options?.canPublish ?? true,
    canSubscribe: options?.canSubscribe ?? true,
    canPublishData: options?.canPublishData ?? true,
    roomAdmin: options?.isAdmin ?? false,
  });

  return await token.toJwt();
}

// ─── Room CRUD ──────────────────────────────────────────────────────────────

export async function createRoom(
  name: string,
  options?: {
    maxParticipants?: number;
    emptyTimeout?: number;
    metadata?: string;
  }
) {
  const client = await getRoomServiceClient();
  const room = await client.createRoom({
    name,
    maxParticipants: options?.maxParticipants ?? 10,
    emptyTimeout: options?.emptyTimeout ?? 600, // 10 min
    metadata: options?.metadata,
  });
  logger.info('[livekit] Room created', { name: room.name });
  return room;
}

export async function listRooms() {
  const client = await getRoomServiceClient();
  return await client.listRooms();
}

export async function getRoom(name: string) {
  const rooms = await listRooms();
  return rooms.find((r: { name: string }) => r.name === name) || null;
}

export async function deleteRoom(name: string) {
  const client = await getRoomServiceClient();
  await client.deleteRoom(name);
  logger.info('[livekit] Room deleted', { name });
}

// ─── Participant Management ─────────────────────────────────────────────────

export async function listParticipants(roomName: string) {
  const client = await getRoomServiceClient();
  return await client.listParticipants(roomName);
}

export async function getParticipant(roomName: string, identity: string) {
  const client = await getRoomServiceClient();
  return await client.getParticipant(roomName, identity);
}

export async function removeParticipant(roomName: string, identity: string) {
  const client = await getRoomServiceClient();
  await client.removeParticipant(roomName, identity);
  logger.info('[livekit] Participant removed', { roomName, identity });
}

export async function muteParticipantTrack(
  roomName: string,
  identity: string,
  trackSid: string,
  muted: boolean
) {
  const client = await getRoomServiceClient();
  await client.mutePublishedTrack(roomName, identity, trackSid, muted);
  logger.info('[livekit] Track muted', { roomName, identity, trackSid, muted });
}

// ─── Public URL ─────────────────────────────────────────────────────────────

export function getPublicLiveKitUrl(): string {
  return process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || '';
}
