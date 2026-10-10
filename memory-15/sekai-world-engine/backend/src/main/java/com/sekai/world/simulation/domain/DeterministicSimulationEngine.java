package com.sekai.world.simulation.domain;

import com.sekai.world.simulation.model.SimulationInput;
import com.sekai.world.simulation.model.SimulationResult;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.SplittableRandom;

@Component
public class DeterministicSimulationEngine {
    public SimulationResult simulate(SimulationInput input) {
        LocalDate toDate = input.currentDate().plusDays(1);
        SplittableRandom random = new SplittableRandom(input.worldSeed() ^ input.currentDate().toEpochDay() ^ input.tickKey().hashCode());
        List<SimulationResult.ActorChange> actorChanges = new ArrayList<>();
        List<SimulationInput.ActorState> actors = input.actors().stream()
                .sorted(Comparator.comparing(SimulationInput.ActorState::id)).toList();

        for (SimulationInput.ActorState actor : actors) {
            int energy = actor.energy();
            int mood = actor.mood();
            Long locationId = actor.locationId();
            String activity = "自由行动";
            SimulationInput.ScheduleState schedule = input.schedules().stream()
                    .filter(item -> item.actorId().equals(actor.id()) && item.dayOfWeek() == toDate.getDayOfWeek().getValue())
                    .sorted(Comparator.comparing(SimulationInput.ScheduleState::activity))
                    .findFirst().orElse(null);
            if (schedule != null) {
                locationId = schedule.locationId();
                energy += schedule.energyDelta();
                mood += schedule.moodDelta();
                activity = schedule.activity();
            }
            for (SimulationInput.RuleState rule : input.rules().stream()
                    .sorted(Comparator.comparing(SimulationInput.RuleState::priority).reversed().thenComparing(SimulationInput.RuleState::code))
                    .toList()) {
                if ("ALWAYS".equals(rule.conditionType()) || ("ENERGY_BELOW".equals(rule.conditionType()) && energy < rule.thresholdValue())) {
                    if ("MOOD_DELTA".equals(rule.effectType())) mood += rule.effectValue();
                    if ("ENERGY_DELTA".equals(rule.effectType())) energy += rule.effectValue();
                }
            }
            energy = clamp(energy, 0, 100);
            mood = clamp(mood, 0, 100);
            String status = mood >= 75 ? "INSPIRED" : mood <= 35 ? "UNSETTLED" : "CALM";
            if (!actor.locationId().equals(locationId) || actor.energy() != energy || actor.mood() != mood || !actor.status().equals(status)) {
                actorChanges.add(new SimulationResult.ActorChange(actor.id(), actor.name(), actor.locationId(), locationId,
                        actor.energy(), energy, actor.mood(), mood, actor.status(), status, activity));
            }
        }

        List<SimulationResult.GeneratedEvent> events = new ArrayList<>();
        for (SimulationInput.TemplateState template : input.templates().stream()
                .sorted(Comparator.comparing(SimulationInput.TemplateState::priority).reversed().thenComparing(SimulationInput.TemplateState::code))
                .toList()) {
            if (random.nextInt(100) < template.probabilityPercent()) {
                Long targetActorId = actors.isEmpty() ? null : actors.get(random.nextInt(actors.size())).id();
                events.add(new SimulationResult.GeneratedEvent(template.id(), targetActorId, template.code(), template.title(), template.description(), template.priority(),
                        template.positiveChoiceLabel(), template.positiveMoodDelta(), template.negativeChoiceLabel(), template.negativeMoodDelta()));
                if (events.size() == 3) break;
            }
        }
        String summary = "世界从 " + input.currentDate() + " 推进到 " + toDate + "，" + actorChanges.size() + " 名角色产生状态变化，生成 " + events.size() + " 个事件。";
        return new SimulationResult(input.currentDate(), toDate, summary, List.copyOf(actorChanges), List.copyOf(events));
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
