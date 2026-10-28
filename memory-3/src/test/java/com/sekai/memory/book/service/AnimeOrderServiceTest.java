package com.sekai.memory.book.service;

import com.sekai.memory.book.model.Anime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AnimeOrderServiceTest {
    private JdbcTemplate jdbc;
    private AnimeService animeService;
    private AnimeOrderService service;
    private List<Anime> anime;

    @BeforeEach
    void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:order" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", ""));
        animeService = mock(AnimeService.class);
        service = new AnimeOrderService(jdbc, animeService);
        service.initialize();
        anime = List.of(anime(1L), anime(2L), anime(3L));
        when(animeService.listByUserId(7L)).thenReturn(anime);
    }

    @Test
    void savesOrderAcrossServiceInstancesAndAppendsNewRecords() {
        assertTrue(service.save(7L, List.of(3L, 1L, 2L)));
        AnimeOrderService restarted = new AnimeOrderService(jdbc, animeService);
        assertEquals(List.of(3L, 1L, 2L), ids(restarted.sort(7L, anime)));
        assertEquals(List.of(3L, 1L, 2L, 4L), ids(restarted.sort(7L,
                List.of(anime(1L), anime(4L), anime(2L), anime(3L)))));
        assertEquals(List.of(3L, 2L), ids(restarted.sort(7L, List.of(anime(2L), anime(3L)))));
        assertEquals(List.of(1L, 2L, 3L), ids(restarted.sort(8L, anime)));
    }

    @Test
    void rejectsForeignDuplicateAndIncompleteListsWithoutChangingSavedOrder() {
        assertTrue(service.save(7L, List.of(2L, 3L, 1L)));
        assertFalse(service.save(7L, List.of(1L, 2L, 99L)));
        assertFalse(service.save(7L, List.of(1L, 2L, 2L)));
        assertFalse(service.save(7L, List.of(1L, 2L)));
        assertEquals(List.of(2L, 3L, 1L), ids(service.sort(7L, anime)));
    }

    private Anime anime(Long id) {
        Anime item = new Anime();
        item.setId(id);
        return item;
    }

    private List<Long> ids(List<Anime> items) {
        return items.stream().map(Anime::getId).toList();
    }
}
