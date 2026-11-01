package com.ykd.claw.math;

import org.matheclipse.core.eval.ExprEvaluator;
import org.matheclipse.core.interfaces.IExpr;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.regex.Pattern;

/**
 * Exact and symbolic math evaluation backed by Symja.
 */
@Service
public class MathComputeService {

    private static final Logger LOGGER = LoggerFactory.getLogger(MathComputeService.class.getName());
    private static final int MAX_EXPRESSION_LENGTH = 2_000;
    private static final int MAX_RESULT_LENGTH = 10_000;
    private static final long TIMEOUT_SECONDS = 5;
    private static final Pattern ASSIGNMENT = Pattern.compile("(?<![<>=!])=(?!=)|:=");
    private static final Pattern FORBIDDEN_FUNCTION = Pattern.compile(
            "(?i)\\b(?:Set|SetDelayed|Unset|Clear|ClearAll|Remove|Get|Import|Export|"
                    + "Put|PutAppend|Run|RunProcess|SystemOpen|Begin|BeginPackage|End|EndPackage)\\b"
    );
    private static final Map<Pattern, String> LEGACY_ALIASES = legacyAliases();

    public String compute(String expression) {
        if (expression == null || expression.isBlank()) {
            throw new IllegalArgumentException("Expression must not be empty");
        }
        String normalized = normalize(expression);
        validate(normalized);
        LOGGER.info("Computing expression: " + normalized);

        try {
            // Do not share evaluators: Symja supports variables and retains evaluation state.
            ExprEvaluator evaluator = new ExprEvaluator(false, (short) 100);
            IExpr result = evaluator.evaluateWithTimeout(
                    normalized, TIMEOUT_SECONDS, TimeUnit.SECONDS, true, null);
            if (result == null || !result.isPresent()) {
                throw new IllegalArgumentException("Expression produced no result");
            }
            String formatted = result.toString();
            if ("$Aborted".equals(formatted)) {
                throw new IllegalArgumentException("Calculation exceeded the "
                        + TIMEOUT_SECONDS + "-second time limit");
            }
            if (formatted.length() > MAX_RESULT_LENGTH) {
                throw new IllegalArgumentException("Calculation result is too large");
            }
            LOGGER.info("Result: " + formatted);
            return formatted;
        } catch (IllegalArgumentException e) {
            LOGGER.warn("Expression evaluation failed: " + e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            LOGGER.warn("Expression evaluation failed: " + e.getMessage());
            throw new IllegalArgumentException("Cannot compute '" + normalized + "': "
                    + safeMessage(e), e);
        }
    }

    private static String normalize(String expression) {
        String normalized = expression.trim()
                .replace('×', '*')
                .replace('÷', '/')
                .replace('−', '-')
                .replace("π", "Pi");
        for (Map.Entry<Pattern, String> alias : LEGACY_ALIASES.entrySet()) {
            normalized = alias.getKey().matcher(normalized).replaceAll(alias.getValue());
        }
        return normalized;
    }

    private static void validate(String expression) {
        if (expression.length() > MAX_EXPRESSION_LENGTH) {
            throw new IllegalArgumentException("Expression is too long (maximum "
                    + MAX_EXPRESSION_LENGTH + " characters)");
        }
        if (expression.indexOf(';') >= 0 || ASSIGNMENT.matcher(expression).find()) {
            throw new IllegalArgumentException("Assignments and multiple statements are not allowed");
        }
        if (FORBIDDEN_FUNCTION.matcher(expression).find()) {
            throw new IllegalArgumentException("This expression contains a forbidden operation");
        }
    }

    private static Map<Pattern, String> legacyAliases() {
        Map<Pattern, String> aliases = new LinkedHashMap<>();
        aliases.put(Pattern.compile("\\bpi\\b"), "Pi");
        aliases.put(Pattern.compile("\\be\\b"), "E");
        aliases.put(Pattern.compile("\\blog\\s*\\("), "Log(10,");
        aliases.put(Pattern.compile("\\bln\\s*\\("), "Log(");
        aliases.put(Pattern.compile("\\bsin\\s*\\("), "Sin(");
        aliases.put(Pattern.compile("\\bcos\\s*\\("), "Cos(");
        aliases.put(Pattern.compile("\\btan\\s*\\("), "Tan(");
        aliases.put(Pattern.compile("\\basin\\s*\\("), "ArcSin(");
        aliases.put(Pattern.compile("\\bacos\\s*\\("), "ArcCos(");
        aliases.put(Pattern.compile("\\batan\\s*\\("), "ArcTan(");
        aliases.put(Pattern.compile("\\bsqrt\\s*\\("), "Sqrt(");
        aliases.put(Pattern.compile("\\babs\\s*\\("), "Abs(");
        aliases.put(Pattern.compile("\\bceil\\s*\\("), "Ceiling(");
        aliases.put(Pattern.compile("\\bfloor\\s*\\("), "Floor(");
        return Map.copyOf(aliases);
    }

    private static String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank()
                ? exception.getClass().getSimpleName()
                : message;
    }
}
