package com.openilink;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openilink.model.CDNMedia;
import com.openilink.model.request.SendMessageReq;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ILinkClientFileMessageTest {

    @Test
    void buildsAudioAsFileAttachmentInsteadOfVoiceItem() throws Exception {
        CDNMedia media = CDNMedia.builder()
                .encryptQueryParam("download-param")
                .aesKey("base64-key")
                .encryptType(1)
                .build();

        SendMessageReq request = ILinkClient.buildFileMessageReq(
                "user-1", "context-1", "client-1", "reply.mp3", 1234, "abc123", media);
        JsonNode msg = new ObjectMapper().valueToTree(request).path("msg");
        JsonNode item = msg.path("item_list").get(0);

        assertEquals("context-1", msg.path("context_token").asText());
        assertEquals(4, item.path("type").asInt());
        assertEquals("reply.mp3", item.path("file_item").path("file_name").asText());
        assertEquals("1234", item.path("file_item").path("len").asText());
        assertFalse(item.has("voice_item"));
    }
}
