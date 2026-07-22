package com.nightcord.duel.repository;

import com.nightcord.duel.entity.UserCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserCardRepository extends JpaRepository<UserCard, Long> {
    List<UserCard> findByUserId(Long userId);
    Optional<UserCard> findByUserIdAndCardId(Long userId, String cardId);
    boolean existsByUserIdAndCardId(Long userId, String cardId);
}
