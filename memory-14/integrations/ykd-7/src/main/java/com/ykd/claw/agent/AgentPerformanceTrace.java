package com.ykd.claw.agent;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;

/** Per-request latency breakdown. Kept outside graph state so checkpoints stay serializable. */
public final class AgentPerformanceTrace {
    private final long startedAt = System.nanoTime();
    private final List<Span> spans = new ArrayList<>();
    private int llmCalls;

    public <T> T measure(String name, Supplier<T> work) {
        long started = System.nanoTime();
        try {
            return work.get();
        } finally {
            add(name, started);
        }
    }

    public void measure(String name, Runnable work) {
        measure(name, () -> {
            work.run();
            return null;
        });
    }

    public <T> T measureLlm(String name, Supplier<T> work) {
        llmCalls++;
        return measure("llm:" + name, work);
    }

    public synchronized String summary() {
        String details = spans.stream()
                .map(span -> span.name + "=" + span.durationMs + "ms")
                .reduce((left, right) -> left + ", " + right)
                .orElse("none");
        return "PERFORMANCE total=" + elapsedMs(startedAt) + "ms llmCalls=" + llmCalls
                + " spans=[" + details + "]";
    }

    private synchronized void add(String name, long started) {
        spans.add(new Span(name, elapsedMs(started)));
    }

    private static long elapsedMs(long started) {
        return (System.nanoTime() - started) / 1_000_000;
    }

    private record Span(String name, long durationMs) { }
}
