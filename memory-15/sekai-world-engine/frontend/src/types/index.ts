export interface User { id: number; email: string; displayName: string }
export interface AuthResult { token: string; user: User }
export interface World { id: number; ownerId: number; name: string; seed: number; visibility: string; createdAt: string }
export interface City { id: number; worldId: number; name: string; description: string }
export interface Location { id: number; cityId: number; name: string; kind: string; capacity: number; description: string }
export interface Faction { id: number; worldId: number; name: string; description: string }
export interface Branch { id: number; worldId: number; parentBranchId?: number; forkSnapshotId?: number; name: string; status: string; createdAt: string }
export interface Clock { branchId: number; currentDate: string; lastTickKey?: string; worldSeed: number; version: number }
export interface Actor { id: number; worldId: number; factionId?: number; locationId: number; name: string; role: string; profileJson: string; stateJson: string; energy: number; mood: number; status: string }
export interface ActorSchedule { id: number; actorId: number; dayOfWeek: number; startTime: string; locationId: number; activity: string; priority: number; energyDelta: number; moodDelta: number }
export interface Relationship { id: number; worldId: number; fromActorId: number; toActorId: number; affinity: number; trust: number; hostility: number; influence: number }
export interface WorldEvent { id: number; branchId: number; templateId?: number; occurredOn: string; status: string; title: string; description: string; payloadJson: string; idempotencyKey: string }
export interface EventChoice { id: number; eventId: number; code: string; label: string; requiredMoodMin: number; moodDelta: number; conditionJson: string; effectJson: string; sortOrder: number }
export interface EventDetails { event: WorldEvent; choices: EventChoice[] }
export interface TimelineEvent { id: number; branchId: number; tickId?: number; eventId?: number; eventType: string; summary: string; payloadJson: string; occurredOn: string }
export interface WorldOverview { world: World; city: City; locations: Location[]; factions: Faction[]; branches: Branch[]; clock: Clock }
export interface WorldState { overview: WorldOverview; branchId: number; actors: Actor[]; events: WorldEvent[]; timeline: TimelineEvent[] }
export interface SimulationResult { fromDate: string; toDate: string; summary: string; actorChanges: ActorChange[]; events: GeneratedEvent[] }
export interface ActorChange { actorId: number; actorName: string; beforeLocationId: number; afterLocationId: number; beforeEnergy: number; afterEnergy: number; beforeMood: number; afterMood: number; beforeStatus: string; afterStatus: string; activity: string }
export interface GeneratedEvent { templateId: number; targetActorId: number; templateCode: string; title: string; description: string; priority: number; positiveChoiceLabel: string; positiveMoodDelta: number; negativeChoiceLabel: string; negativeMoodDelta: number }
export interface AdvanceResult { idempotent: boolean; tick: { id: number; branchId: number; tickKey: string; fromDate: string; toDate: string; resultJson: string }; result: SimulationResult }
