package com.ykd.claw.webui.dto;

import java.time.Instant;

/** 知识库文档的只读视图。 */
public record KnowledgeDocumentView(Long id, String fileName, String sourcePath,
                                    long chunkCount, Instant createdTime) {
}
