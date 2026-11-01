package com.ykd.claw.math;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MathComputeServiceTest {

    private final MathComputeService service = new MathComputeService();

    @Test
    void evaluatesExactArithmeticAndLargeIntegers() {
        assertEquals("1/2", service.compute("1/3 + 1/6"));
        assertEquals("1267650600228229401496703205376", service.compute("2^100"));
    }

    @Test
    void supportsSymbolicAlgebraCalculusAndEquations() {
        assertEquals("(-1+x)*(1+x)", service.compute("Factor(x^2-1)"));
        assertEquals("2*x*Cos(x^2)", service.compute("D(Sin(x^2),x)"));
        assertEquals("x^3/3", service.compute("Integrate(x^2,x)"));

        String solutions = service.compute("Solve(x^2==4,x)");
        assertTrue(solutions.contains("x->-2"));
        assertTrue(solutions.contains("x->2"));
    }

    @Test
    void keepsLegacyLowercaseFunctionSyntax() {
        assertEquals("24", service.compute("sqrt(144) * log(100)"));
        assertEquals("1", service.compute("sin(PI/2)"));
    }

    @Test
    void rejectsStatefulOrOversizedInput() {
        assertThrows(IllegalArgumentException.class, () -> service.compute("a=10"));
        assertThrows(IllegalArgumentException.class, () -> service.compute("1+1; 2+2"));
        assertThrows(IllegalArgumentException.class, () -> service.compute("x".repeat(2_001)));
    }

    @Test
    void evaluatorsDoNotShareVariablesBetweenCalls() {
        assertThrows(IllegalArgumentException.class, () -> service.compute("a=10"));
        assertEquals("a", service.compute("a"));
    }
}
