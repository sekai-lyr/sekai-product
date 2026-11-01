package com.ykd.claw.user.repository;

import com.ykd.claw.user.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findByUserId(String userId);

    boolean existsByUserId(String userId);
}
