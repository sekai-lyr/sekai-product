package com.nightcord.duel.service;

import com.nightcord.duel.entity.Card;
import com.nightcord.duel.entity.Deck;
import com.nightcord.duel.entity.DeckCard;
import com.nightcord.duel.entity.User;
import com.nightcord.duel.repository.DeckCardRepository;
import com.nightcord.duel.repository.DeckRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class DeckService {

    @Autowired
    private DeckRepository deckRepository;

    @Autowired
    private DeckCardRepository deckCardRepository;

    public List<Deck> getUserDecks(Long userId) {
        return deckRepository.findByUserId(userId);
    }

    public Optional<Deck> getDeckById(String deckId) {
        return deckRepository.findById(deckId);
    }

    @Transactional
    public Deck createDeck(Long userId, String name, String coverCardId, List<String> mainCardIds) {
        User user = new User();
        user.setId(userId);

        Deck deck = new Deck();
        deck.setId("deck_" + userId + "_" + System.currentTimeMillis());
        deck.setUser(user);
        deck.setName(name);
        deck.setCoverCardId(coverCardId);
        deck.setIsPreset(false);

        deck = deckRepository.save(deck);

        if (mainCardIds != null && !mainCardIds.isEmpty()) {
            List<DeckCard> deckCards = new ArrayList<>();
            for (int i = 0; i < mainCardIds.size(); i++) {
                DeckCard dc = new DeckCard();
                dc.setDeck(deck);
                dc.setCard(new Card(mainCardIds.get(i)));
                dc.setSlotType("main");
                dc.setPosition(i);
                deckCards.add(dc);
            }
            deckCardRepository.saveAll(deckCards);
        }

        return deck;
    }

    @Transactional
    public Deck updateDeck(String deckId, String name, String coverCardId,
                           List<String> mainCardIds, List<String> extraCardIds, List<String> sideCardIds) {
        Deck deck = deckRepository.findById(deckId)
            .orElseThrow(() -> new RuntimeException("卡组不存在"));

        if (name != null) deck.setName(name);
        if (coverCardId != null) deck.setCoverCardId(coverCardId);

        deckCardRepository.deleteByDeckId(deckId);

        List<DeckCard> allCards = new ArrayList<>();
        addSlotCards(deck, "main", mainCardIds, allCards);
        addSlotCards(deck, "extra", extraCardIds, allCards);
        addSlotCards(deck, "side", sideCardIds, allCards);
        deckCardRepository.saveAll(allCards);

        return deckRepository.save(deck);
    }

    private void addSlotCards(Deck deck, String slotType, List<String> cardIds, List<DeckCard> allCards) {
        if (cardIds == null) return;
        for (int i = 0; i < cardIds.size(); i++) {
            DeckCard dc = new DeckCard();
            dc.setDeck(deck);
            dc.setCard(new Card(cardIds.get(i)));
            dc.setSlotType(slotType);
            dc.setPosition(i);
            allCards.add(dc);
        }
    }

    @Transactional
    public void deleteDeck(String deckId) {
        deckCardRepository.deleteByDeckId(deckId);
        deckRepository.deleteById(deckId);
    }

    public List<String> getDeckCardIds(String deckId, String slotType) {
        List<DeckCard> deckCards = deckCardRepository.findByDeckIdAndSlotType(deckId, slotType);
        return deckCards.stream()
            .map(dc -> dc.getCard().getId())
            .toList();
    }
}
