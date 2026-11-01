package com.example.demo.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JsonUtilsTest {

    @Test
    void unescapeCommonSequences() {
        assertEquals("line1\nline2", JsonUtils.unescapeJson("line1\\nline2"));
        assertEquals("a\tb", JsonUtils.unescapeJson("a\\tb"));
        assertEquals("say \"hi\"", JsonUtils.unescapeJson("say \\\"hi\\\""));
        assertEquals("back\\slash", JsonUtils.unescapeJson("back\\\\slash"));
    }

    @Test
    void unknownEscapeKeepsBackslash() {
        assertEquals("\\x", JsonUtils.unescapeJson("\\x"));
    }

    @Test
    void nullAndEmptyReturnEmpty() {
        assertEquals("", JsonUtils.unescapeJson(null));
        assertEquals("", JsonUtils.unescapeJson(""));
    }

    @Test
    void plainTextUnchanged() {
        assertEquals("普通文本，无转义。", JsonUtils.unescapeJson("普通文本，无转义。"));
    }
}
