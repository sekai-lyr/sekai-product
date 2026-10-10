package com.sekai.game.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.game.entity.Card;
import com.sekai.game.entity.User;
import com.sekai.game.repository.CardRepository;
import com.sekai.game.repository.UserCardRepository;
import com.sekai.game.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CollectionServiceTest {

    @Mock
    private UserCardRepository userCardRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CollectionService collectionService;

    @Test
    void saveCollectionPersistsCardsButIgnoresClientEconomy() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setUsername("sekai");

        Card card = new Card("card-1");
        card.setEnabled(true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cardRepository.findById("card-1")).thenReturn(Optional.of(card));

        Map<String, Object> body = new HashMap<>();
        body.put("cards", Map.of("card-1", 1));
        body.put("duelCoins", 1234);
        body.put("packsOpened", 7);
        body.put("shards", Map.of("UR", 200));
        body.put("pityCounters", Map.of(
            "nightcord_pack_001", Map.of("packsSinceUR", 7)
        ));

        Map<String, Object> result = collectionService.saveCollection(1L, body);

        assertEquals(1, result.get("cards"));
        assertEquals(2000, user.getDuelCoins());
        assertEquals(0, user.getPacksOpened());
        assertEquals(0, new ObjectMapper().readTree(user.getShardsJson()).get("UR").asInt());
        assertEquals("{}", user.getPityCountersJson());
    }

    @Test
    void singleSummonReturnsOneCardAndCostsThreeHundredDimensionCoins() {
        User user = new User();
        user.setId(1L);
        user.setDuelCoins(2000);

        Card card = new Card("card-1");
        card.setName("测试卡");
        card.setRarity("N");
        card.setType("monster");
        card.setEnabled(true);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(cardRepository.findAll()).thenReturn(List.of(card));
        when(cardRepository.findById("card-1")).thenReturn(Optional.of(card));
        when(userCardRepository.findByUserId(1L)).thenReturn(List.of());
        when(userCardRepository.findByUserIdAndCardId(1L, "card-1")).thenReturn(Optional.empty());
        doAnswer(invocation -> {
            user.setDuelCoins(user.getDuelCoins() - 300);
            return 1;
        }).when(userRepository).spendDuelCoins(1L, 300);

        Map<String, Object> result = collectionService.openPack(1L, "nightcord", 1);

        assertEquals(true, result.get("success"));
        assertEquals(1, ((List<?>) result.get("cards")).size());
        assertEquals(1700, result.get("duelCoins"));
        assertEquals(1, result.get("packsOpened"));
        verify(userRepository).spendDuelCoins(1L, 300);
        verify(userRepository).save(any(User.class));
    }

    @Test
    void legacyEightCardRequestIsRejected() {
        Map<String, Object> result = collectionService.openPack(1L, "nightcord", 8);

        assertEquals(false, result.get("success"));
        assertEquals("一次只能单抽或十连", result.get("reason"));
    }
}
