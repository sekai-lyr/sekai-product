package com.sekai.world.simulation.model;

import java.time.LocalDate;
import java.util.List;

public record SimulationInput(LocalDate currentDate, long worldSeed, String tickKey,
                              List<ActorState> actors, List<ScheduleState> schedules,
                              List<RuleState> rules, List<TemplateState> templates) {
    public record ActorState(Long id, String name, Long locationId, int energy, int mood, String status) {}
    public record ScheduleState(Long actorId, int dayOfWeek, Long locationId, String activity,
                                int energyDelta, int moodDelta) {}
    public record RuleState(String code, String conditionType, int thresholdValue,
                            String effectType, int effectValue, int priority) {}
    public record TemplateState(Long id, String code, String title, String description,
                                int probabilityPercent, int priority,
                                String positiveChoiceLabel, int positiveMoodDelta,
                                String negativeChoiceLabel, int negativeMoodDelta) {}
}
