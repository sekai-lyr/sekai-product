package com.nightcord.duel.repository;

import com.nightcord.duel.entity.DeckCard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeckCardRepository extends JpaRepository<DeckCard, Long> {
    List<DeckCard> findByDeckId(String deckId);
    List<DeckCard> findByDeckIdAndSlotType(String deckId, String slotType);
    void deleteByDeckId(String deckId);
}
