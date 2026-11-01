package com.ykd.claw.memory;

import com.ykd.claw.memory.entity.ChatMessageEntity;
import com.ykd.claw.memory.entity.MemoryEntity;
import com.ykd.claw.memory.repository.ConversationJpaRepository;
import com.ykd.claw.memory.repository.MemoryJpaRepository;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public final class TestJpaRepositories {
    private TestJpaRepositories() {
    }

    public static MemoryJpaRepository memoryRepository() {
        List<MemoryEntity> stored = new ArrayList<>();
        MemoryJpaRepository repository = mock(MemoryJpaRepository.class);
        when(repository.existsByUserIdAndTypeIgnoreCaseAndContentIgnoreCase(
                anyString(), anyString(), anyString())).thenAnswer(invocation -> stored.stream().anyMatch(item ->
                item.getUserId().equals(invocation.getArgument(0))
                        && item.getType().equalsIgnoreCase(invocation.getArgument(1))
                        && item.getContent().equalsIgnoreCase(invocation.getArgument(2))));
        when(repository.save(any(MemoryEntity.class))).thenAnswer(invocation -> {
            MemoryEntity entity = invocation.getArgument(0);
            stored.add(entity);
            return entity;
        });
        when(repository.saveAll(any())).thenAnswer(invocation -> {
            Iterable<MemoryEntity> entities = invocation.getArgument(0);
            entities.forEach(stored::add);
            return entities;
        });
        when(repository.findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(
                anyString(), any(Pageable.class))).thenAnswer(invocation -> {
            String userId = invocation.getArgument(0);
            Pageable pageable = invocation.getArgument(1);
            return stored.stream()
                    .filter(item -> item.getUserId().equals(userId))
                    .sorted(Comparator.comparingInt(MemoryEntity::getImportance).reversed()
                            .thenComparing(MemoryEntity::getCreatedTime, Comparator.reverseOrder()))
                    .limit(pageable.getPageSize())
                    .toList();
        });
        return repository;
    }

    public static ConversationJpaRepository conversationRepository() {
        List<ChatMessageEntity> stored = new ArrayList<>();
        ConversationJpaRepository repository = mock(ConversationJpaRepository.class);
        when(repository.saveAll(any())).thenAnswer(invocation -> {
            Iterable<ChatMessageEntity> entities = invocation.getArgument(0);
            entities.forEach(stored::add);
            return entities;
        });
        when(repository.findByUserIdAndConversationIdAndRoleInOrderByCreatedTimeDescIdDesc(
                anyString(), anyString(), anyList(), any(Pageable.class))).thenAnswer(invocation -> {
            String userId = invocation.getArgument(0);
            String conversationId = invocation.getArgument(1);
            List<String> roles = invocation.getArgument(2);
            Pageable pageable = invocation.getArgument(3);
            List<ChatMessageEntity> result = new ArrayList<>(stored.stream()
                    .filter(item -> item.getUserId().equals(userId)
                            && item.getConversationId().equals(conversationId)
                            && roles.contains(item.getRole()))
                    .toList());
            java.util.Collections.reverse(result);
            return result.stream().limit(pageable.getPageSize()).toList();
        });
        when(repository.countByUserIdAndConversationIdAndRoleIn(
                anyString(), anyString(), anyList())).thenAnswer(invocation ->
                stored.stream().filter(item -> item.getUserId().equals(invocation.getArgument(0))
                        && item.getConversationId().equals(invocation.getArgument(1))
                        && invocation.<List<String>>getArgument(2).contains(item.getRole())).count());
        doAnswer(invocation -> {
            stored.removeIf(item -> item.getUserId().equals(invocation.getArgument(0))
                    && item.getConversationId().equals(invocation.getArgument(1)));
            return null;
        }).when(repository).deleteByUserIdAndConversationId(anyString(), anyString());
        return repository;
    }
}
