package com.ykd.claw.math;

import com.ykd.claw.agent.ToolProvider;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * Exact numeric and symbolic computation powered by Symja.
 */
@Component
public final class MathComputeTool implements ToolProvider {

    private final MathComputeService mathService;

    public MathComputeTool(MathComputeService mathService) {
        this.mathService = mathService;
    }

    @Tool(name = "math_compute", description = "Perform exact numeric or symbolic mathematics with Symja. "
            + "Use for arithmetic, fractions, large integers, simplification, polynomial expansion/factoring, "
            + "equation solving, derivatives, integrals, limits, matrices and high-precision values. "
            + "Examples: 1/3+1/6, Factor(x^2-1), Solve(x^2==4,x), D(Sin(x)^2,x), "
            + "Integrate(x^2,x), N(Pi,20).")
    public String mathCompute(
            @ToolParam(description = "One Symja math expression. Use == inside equations and N(expression, digits) "
                    + "when a decimal result is required. Do not use assignments or multiple statements.")
            String expression) {
        if (expression == null || expression.isBlank()) {
            throw new IllegalArgumentException("expression is required");
        }
        try {
            return mathService.compute(expression);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Math computation failed: " + e.getMessage(), e);
        }
    }
}
