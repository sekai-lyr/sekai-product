package com.ykd.claw.web;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebContentSelectorTest {

    @Test
    void selectsQuestionRelevantChunksWithinBudget() {
        String content = "Introduction ".repeat(300)
                + "\n\nArchitecture details ".repeat(200)
                + "\n\nPricing costs 20 dollars per month. Enterprise pricing is negotiable."
                + "\n\nUnrelated appendix ".repeat(200);
        WebContentSelector selector = new WebContentSelector(2_000, 500, 3);

        WebContentSelector.Selection result = selector.select(content,
                "\u8fd9\u4e2a\u4ea7\u54c1\u7684\u4ef7\u683c\u548c\u8d39\u7528\u662f\u591a\u5c11\u94b1\uff1f");

        assertTrue(result.content().contains("Pricing costs"));
        assertTrue(result.selectedChars() <= 2_000);
        assertTrue(result.truncated());
        assertTrue(result.selectedChunks() <= 3);
    }

    @Test
    void keepsShortPagesUnchanged() {
        WebContentSelector selector = new WebContentSelector(8_000, 1_200, 6);

        WebContentSelector.Selection result = selector.select("Short useful page.", null);

        assertFalse(result.truncated());
        assertTrue(result.content().equals("Short useful page."));
    }
}
