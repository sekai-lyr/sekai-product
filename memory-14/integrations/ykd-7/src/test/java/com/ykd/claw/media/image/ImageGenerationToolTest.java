package com.ykd.claw.media.image;

import com.ykd.claw.agent.GeneratedArtifacts;
import org.junit.jupiter.api.Test;

import java.net.http.HttpTimeoutException;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ImageGenerationToolTest {

    @Test
    void timeoutBecomesAToolResultSoOtherIntentsCanContinue() throws Exception {
        ImageGenerationService service = mock(ImageGenerationService.class);
        when(service.generate("一只小猫")).thenThrow(new HttpTimeoutException("timeout"));
        ImageGenerationTool tool = new ImageGenerationTool(new GeneratedArtifacts(), service);

        String result = tool.generateImage("一只小猫");

        assertTrue(result.contains("timed out"));
        assertTrue(result.contains("other requests"));
    }
}
