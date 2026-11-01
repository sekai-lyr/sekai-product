package com.ykd.claw.memory.repository;

import com.ykd.claw.memory.entity.MemoryEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemoryJpaRepository extends JpaRepository<MemoryEntity, Long> {
    boolean existsByUserIdAndTypeIgnoreCaseAndContentIgnoreCase(String userId, String type, String content);

    List<MemoryEntity> findByUserIdOrderByImportanceDescCreatedTimeDescIdDesc(String userId, Pageable pageable);

    List<MemoryEntity> findAllByOrderByCreatedTimeDesc(Pageable pageable);

    Optional<MemoryEntity> findByIdAndUserId(Long id, String userId);
}
