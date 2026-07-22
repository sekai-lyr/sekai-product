package com.nightcord.duel.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "sekai_card_deck_cards")
public class DeckCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deck_id", nullable = false)
    private Deck deck;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    private Card card;

    @Column(nullable = false, length = 20)
    private String slotType; // main, extra, side

    @Column(nullable = false)
    private Integer position;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Deck getDeck() { return deck; }
    public void setDeck(Deck deck) { this.deck = deck; }

    public Card getCard() { return card; }
    public void setCard(Card card) { this.card = card; }

    public String getSlotType() { return slotType; }
    public void setSlotType(String slotType) { this.slotType = slotType; }

    public Integer getPosition() { return position; }
    public void setPosition(Integer position) { this.position = position; }
}
