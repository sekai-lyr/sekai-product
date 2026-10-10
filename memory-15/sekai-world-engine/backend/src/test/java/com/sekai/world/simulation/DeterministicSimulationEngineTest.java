package com.sekai.world.simulation;

import com.sekai.world.simulation.domain.DeterministicSimulationEngine;
import com.sekai.world.simulation.model.SimulationInput;
import com.sekai.world.simulation.model.SimulationResult;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeterministicSimulationEngineTest {
    private final DeterministicSimulationEngine engine = new DeterministicSimulationEngine();

    @Test
    void sameInputProducesSameResult() {
        SimulationInput input = input("tick-001");

        SimulationResult first = engine.simulate(input);
        SimulationResult second = engine.simulate(input);

        assertThat(second).isEqualTo(first);
        assertThat(first.toDate()).isEqualTo(LocalDate.of(2026, 1, 2));
        assertThat(first.events()).isNotEmpty();
    }

    @Test
    void scheduleAndRulesChangeActorStateWithinBounds() {
        SimulationResult result = engine.simulate(input("tick-schedule"));

        SimulationResult.ActorChange change = result.actorChanges().getFirst();
        assertThat(change.afterLocationId()).isEqualTo(2L);
        assertThat(change.afterEnergy()).isBetween(0, 100);
        assertThat(change.afterMood()).isBetween(0, 100);
        assertThat(change.activity()).isEqualTo("到车站观察潮汐");
    }

    private SimulationInput input(String tickKey) {
        return new SimulationInput(
                LocalDate.of(2026, 1, 1), 42L, tickKey,
                List.of(new SimulationInput.ActorState(1L, "林澈", 1L, 40, 60, "CALM")),
                List.of(new SimulationInput.ScheduleState(1L, 5, 2L, "到车站观察潮汐", -3, 2)),
                List.of(new SimulationInput.RuleState("always-rest", "ALWAYS", 0, "MOOD_DELTA", 1, 1)),
                List.of(new SimulationInput.TemplateState(1L, "signal", "潮汐信号", "一段信号", 100, 1, "调查", 5, "记录", -2))
        );
    }
}
