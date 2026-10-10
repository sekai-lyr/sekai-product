package com.sekai.world.world.service;

import com.sekai.world.actor.mapper.ActorMapper;
import com.sekai.world.actor.model.Actor;
import com.sekai.world.location.mapper.FactionMapper;
import com.sekai.world.location.mapper.LocationMapper;
import com.sekai.world.location.model.City;
import com.sekai.world.location.model.Faction;
import com.sekai.world.location.model.Location;
import com.sekai.world.relationship.mapper.RelationshipMapper;
import com.sekai.world.simulation.mapper.SimulationMapper;
import com.sekai.world.world.mapper.WorldMapper;
import com.sekai.world.world.model.World;
import com.sekai.world.world.model.WorldBranch;
import com.sekai.world.world.model.WorldClock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class WorldService {
    private static final LocalDate SEED_START_DATE = LocalDate.of(2026, 1, 1);
    private final WorldMapper worldMapper;
    private final LocationMapper locationMapper;
    private final FactionMapper factionMapper;
    private final ActorMapper actorMapper;
    private final RelationshipMapper relationshipMapper;
    private final SimulationMapper simulationMapper;
    private final SeedWorldCatalog catalog;

    public WorldService(WorldMapper worldMapper, LocationMapper locationMapper, FactionMapper factionMapper,
                        ActorMapper actorMapper, RelationshipMapper relationshipMapper,
                        SimulationMapper simulationMapper, SeedWorldCatalog catalog) {
        this.worldMapper = worldMapper;
        this.locationMapper = locationMapper;
        this.factionMapper = factionMapper;
        this.actorMapper = actorMapper;
        this.relationshipMapper = relationshipMapper;
        this.simulationMapper = simulationMapper;
        this.catalog = catalog;
    }

    @Transactional
    public World createSeedWorld(Long ownerId, String requestedName, Long requestedSeed) {
        String name = requestedName == null || requestedName.isBlank() ? "星港初航" : requestedName.trim();
        long seed = requestedSeed == null ? 20260101L : requestedSeed;
        WorldMapper.WorldDraft worldDraft = new WorldMapper.WorldDraft(ownerId, name, seed, "PRIVATE");
        worldMapper.insert(worldDraft);
        Long worldId = worldDraft.getId();

        WorldMapper.CityDraft cityDraft = new WorldMapper.CityDraft(worldId, catalog.cityName(), catalog.cityDescription());
        worldMapper.insertCity(cityDraft);
        Long cityId = cityDraft.getId();

        List<Long> locationIds = new ArrayList<>();
        for (SeedWorldCatalog.LocationSeed location : catalog.locations()) {
            LocationMapper.LocationDraft draft = new LocationMapper.LocationDraft(cityId, location.name(), location.kind(), location.capacity(), location.description());
            locationMapper.insert(draft);
            locationIds.add(draft.getId());
        }
        for (int i = 0; i < locationIds.size(); i++) {
            Long from = locationIds.get(i);
            Long to = locationIds.get((i + 1) % locationIds.size());
            locationMapper.insertConnection(new LocationMapper.ConnectionDraft(from, to, 1));
        }

        List<Long> factionIds = new ArrayList<>();
        for (SeedWorldCatalog.FactionSeed faction : catalog.factions()) {
            FactionMapper.FactionDraft draft = new FactionMapper.FactionDraft(worldId, faction.name(), faction.description());
            factionMapper.insert(draft);
            factionIds.add(draft.getId());
        }

        List<Long> actorIds = new ArrayList<>();
        List<SeedWorldCatalog.ActorSeed> actorSeeds = catalog.actors();
        for (SeedWorldCatalog.ActorSeed actor : actorSeeds) {
            Long factionId = actor.factionIndex() < 0 ? null : factionIds.get(actor.factionIndex());
            Long locationId = locationIds.get(actor.locationIndex());
            String profile = "{\"archetype\":\"original\",\"role\":\"" + actor.role() + "\"}";
            String state = "{\"energy\":70,\"mood\":60,\"status\":\"CALM\"}";
            ActorMapper.ActorDraft draft = new ActorMapper.ActorDraft(worldId, factionId, locationId, actor.name(), actor.role(), profile, state, 70, 60, "CALM");
            actorMapper.insert(draft);
            actorIds.add(draft.getId());
        }
        for (int i = 0; i < actorIds.size(); i++) {
            SeedWorldCatalog.ActorSeed actor = actorSeeds.get(i);
            int scheduledDay = (i % 7) + 1;
            long scheduleLocation = locationIds.get((actor.locationIndex() + 1) % locationIds.size());
            actorMapper.insertSchedule(new ActorMapper.ScheduleDraft(actorIds.get(i), scheduledDay, LocalTime.of(9, 0), scheduleLocation, "日程：" + actor.role(), 10, -3, 2));
        }
        for (int i = 0; i < actorIds.size(); i++) {
            relationshipMapper.insert(new RelationshipMapper.RelationshipDraft(worldId, actorIds.get(i), actorIds.get((i + 1) % actorIds.size()), 12, 8, 0, 10));
        }
        for (SeedWorldCatalog.RuleSeed rule : catalog.rules()) {
            String conditionJson = "{\"type\":\"" + rule.conditionType() + "\",\"threshold\":" + rule.thresholdValue() + "}";
            String effectJson = "{\"type\":\"" + rule.effectType() + "\",\"amount\":" + rule.effectValue() + "}";
            simulationMapper.insertRule(new SimulationMapper.RuleDraft(worldId, rule.code(), rule.name(), rule.conditionType(), rule.thresholdValue(), rule.effectType(), rule.effectValue(), conditionJson, effectJson, 100 - rule.effectValue()));
        }
        for (SeedWorldCatalog.TemplateSeed template : catalog.templates()) {
            simulationMapper.insertTemplate(new SimulationMapper.TemplateDraft(worldId, template.code(), template.name(), template.description(), template.probabilityPercent(), template.priority(), template.positiveLabel(), template.positiveMoodDelta(), template.negativeLabel(), template.negativeMoodDelta()));
        }

        WorldMapper.BranchDraft branch = new WorldMapper.BranchDraft(worldId, null, null, "主线", "ACTIVE");
        worldMapper.insertBranch(branch);
        worldMapper.insertClock(new WorldMapper.ClockDraft(branch.getId(), SEED_START_DATE, null, seed));
        for (int i = 0; i < actorIds.size(); i++) {
            Actor actor = actorMapper.find(worldId, actorIds.get(i));
            actorMapper.insertBranchState(new ActorMapper.BranchStateDraft(branch.getId(), actor.id(), actor.locationId(), actor.energy(), actor.mood(), actor.status(), actor.stateJson()));
        }
        return findOwned(worldId, ownerId);
    }

    public List<World> listOwned(Long ownerId) {
        return worldMapper.listByOwner(ownerId);
    }

    public World findOwned(Long worldId, Long ownerId) {
        World world = worldMapper.findByIdAndOwner(worldId, ownerId);
        if (world == null) {
            throw com.sekai.world.common.api.ApiException.notFound("World not found");
        }
        return world;
    }

    public WorldBranch requireBranch(Long worldId, Long branchId, Long ownerId) {
        findOwned(worldId, ownerId);
        WorldBranch branch = worldMapper.findBranch(worldId, branchId);
        if (branch == null) {
            throw com.sekai.world.common.api.ApiException.notFound("Branch not found");
        }
        return branch;
    }

    public WorldOverview overview(Long worldId, Long ownerId) {
        return overview(worldId, ownerId, null);
    }

    public WorldOverview overview(Long worldId, Long ownerId, Long requestedBranchId) {
        World world = findOwned(worldId, ownerId);
        City city = locationMapper.findCity(worldId);
        List<Location> locations = locationMapper.listByWorld(worldId);
        List<Faction> factions = factionMapper.listByWorld(worldId);
        List<WorldBranch> branches = worldMapper.listBranches(worldId);
        Long branchId = requestedBranchId == null && !branches.isEmpty() ? branches.get(0).id() : requestedBranchId;
        WorldClock clock = branchId == null ? null : worldMapper.findClock(branchId);
        return new WorldOverview(world, city, locations, factions, branches, clock);
    }

    public record WorldOverview(World world, City city, List<Location> locations, List<Faction> factions,
                                List<WorldBranch> branches, WorldClock clock) {}
}
