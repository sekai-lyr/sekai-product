package com.nightcord.duel.repository;

import com.nightcord.duel.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeckRepository extends JpaRepository<Deck, String> {
    List<Deck> findByUserId(Long userId);
    List<Deck> findByUserIdAndIsPreset(Long userId, Boolean isPreset);
}
