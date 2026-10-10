package com.sekai.world.simulation.model;

import java.time.LocalDate;
import java.util.List;

public record SimulationResult(LocalDate fromDate, LocalDate toDate, String summary,
                               List<ActorChange> actorChanges, List<GeneratedEvent> events) {
    public record ActorChange(Long actorId, String actorName, Long beforeLocationId, Long afterLocationId,
                              int beforeEnergy, int afterEnergy, int beforeMood, int afterMood,
                              String beforeStatus, String afterStatus, String activity) {}

    public record GeneratedEvent(Long templateId, Long targetActorId, String templateCode, String title,
                                 String description, int priority, String positiveChoiceLabel,
                                 int positiveMoodDelta, String negativeChoiceLabel,
                                 int negativeMoodDelta) {}
}
