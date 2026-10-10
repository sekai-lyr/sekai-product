import { api } from './client'
import type { Actor, ActorSchedule, AdvanceResult, Branch, EventDetails, Faction, Location, Relationship, SimulationResult, TimelineEvent, User, World, WorldEvent, WorldOverview, WorldState } from '../types'

export const authApi = {
  register: (body: { email: string; password: string; displayName: string }) => api.post<{ token: string; user: User }>('/auth/register', body),
  login: (body: { email: string; password: string }) => api.post<{ token: string; user: User }>('/auth/login', body),
  me: () => api.get<User>('/auth/me')
}

export const worldApi = {
  list: () => api.get<World[]>('/worlds'),
  create: (body: { name: string; seed?: number }) => api.post<World>('/worlds', body),
  overview: (worldId: number) => api.get<WorldOverview>(`/worlds/${worldId}`),
  state: (worldId: number, branchId: number) => api.get<WorldState>(`/worlds/${worldId}/state`, { params: { branchId } }),
  locations: (worldId: number) => api.get<Location[]>(`/worlds/${worldId}/locations`),
  actors: (worldId: number, branchId: number) => api.get<Actor[]>(`/worlds/${worldId}/actors`, { params: { branchId } }),
  actor: (worldId: number, actorId: number, branchId: number) => api.get<{ actor: Actor; schedules: ActorSchedule[]; relationships: Relationship[] }>(`/worlds/${worldId}/actors/${actorId}`, { params: { branchId } }),
  events: (worldId: number, branchId: number) => api.get<WorldEvent[]>(`/worlds/${worldId}/events`, { params: { branchId } }),
  event: (worldId: number, eventId: number, branchId: number) => api.get<EventDetails>(`/worlds/${worldId}/events/${eventId}`, { params: { branchId } }),
  choose: (worldId: number, eventId: number, branchId: number, choiceCode: string) => api.post(`/worlds/${worldId}/events/${eventId}/choices`, { choiceCode }, { params: { branchId } }),
  advance: (worldId: number, branchId: number, idempotencyKey: string) => api.post<AdvanceResult>(`/worlds/${worldId}/advance`, { branchId, idempotencyKey }),
  timeline: (worldId: number, branchId: number) => api.get<TimelineEvent[]>(`/worlds/${worldId}/timeline`, { params: { branchId } }),
  branches: (worldId: number) => api.get<Branch[]>(`/worlds/${worldId}/branches`),
  fork: (worldId: number, sourceBranchId: number, timelineEventId: number, name: string) => api.post(`/worlds/${worldId}/branches`, { sourceBranchId, timelineEventId, name })
}
