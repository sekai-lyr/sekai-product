package com.ykd.claw.webui.dto;

import com.ykd.claw.memory.ChatMessageRecord;

import java.time.Instant;

/** 单条会话消息的只读视图(供监测看板展示,id 作为"加载更早"的游标)。 */
public record MessageView(Long id, String role, String content, String toolName, Instant createdTime) {

    public static MessageView from(ChatMessageRecord record) {
        return new MessageView(record.id(), record.role(), record.content(), record.toolName(),
                record.createdTime());
    }
}
