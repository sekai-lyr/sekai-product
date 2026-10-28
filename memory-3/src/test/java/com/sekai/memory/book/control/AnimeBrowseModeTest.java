package com.sekai.memory.book.control;

import com.sekai.memory.book.model.Anime;
import com.sekai.memory.book.model.User;
import com.sekai.memory.book.service.AnimeService;
import com.sekai.memory.book.service.AnimeOrderService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.ui.ExtendedModelMap;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnimeBrowseModeTest {
    @Mock private AnimeService animeService;
    @Mock private AnimeOrderService animeOrderService;
    @InjectMocks private PageControl controller;

    @Test
    void pagedModeKeepsEightItemsAndClampsPage() {
        MockHttpSession session = session();
        when(animeService.countByUserId(7L, null)).thenReturn(21);
        when(animeService.listByUserId(7L, null, 3, 8)).thenReturn(List.of());
        ExtendedModelMap model = new ExtendedModelMap();
        assertEquals("anime", controller.anime(session, model, null, 99, false, "paged", "default"));
        assertEquals(3, model.get("currentPage"));
        assertEquals(false, model.get("continuous"));
        verifyNoInteractions(animeOrderService);
    }

    @Test
    void continuousModeLoadsAllAndRemembersModeWhileFilteringDisablesReordering() {
        MockHttpSession session = session();
        List<Anime> all = List.of(new Anime(), new Anime());
        when(animeService.countByUserId(7L, null)).thenReturn(21);
        when(animeService.listByUserId(7L, (String) null)).thenReturn(all);
        when(animeOrderService.sort(7L, all)).thenReturn(all);
        ExtendedModelMap model = new ExtendedModelMap();
        controller.anime(session, model, null, 2, false, "continuous", "default");
        assertSame(all, model.get("animeList"));
        assertEquals(true, model.get("canReorder"));
        assertEquals("continuous", session.getAttribute("animeViewMode"));
        when(animeService.listByUserId(7L, "test")).thenReturn(all);
        ExtendedModelMap filtered = new ExtendedModelMap();
        controller.anime(session, filtered, "test", 1, false, null, "default");
        assertEquals(true, filtered.get("continuous"));
        assertEquals(false, filtered.get("canReorder"));
        verify(animeService, never()).listByUserId(anyLong(), any(), anyInt(), anyInt());
    }

    @Test
    void sortsWholeLibraryBeforePagingAndKeepsMissingDatesLast() {
        List<Anime> all = new java.util.ArrayList<>();
        for (long id = 1; id <= 10; id++) {
            Anime anime = new Anime();
            anime.setId(id);
            anime.setReleaseDate(java.time.LocalDate.of(2020, 1, (int) id));
            anime.setCreateTime(java.time.LocalDateTime.of(2026, 1, 11 - (int) id, 12, 0));
            all.add(anime);
        }
        Anime missing = new Anime();
        missing.setId(11L);
        all.add(missing);
        when(animeService.countByUserId(7L, null)).thenReturn(11);
        when(animeService.listByUserId(7L, (String) null)).thenReturn(all);
        for (String sort : List.of("release-asc", "release-desc", "added-asc", "added-desc")) {
            ExtendedModelMap model = new ExtendedModelMap();
            controller.anime(session(), model, null, 1, false, "continuous", sort);
            @SuppressWarnings("unchecked") List<Anime> result = (List<Anime>) model.get("animeList");
            assertEquals(11L, result.getLast().getId());
            assertEquals(sort.equals("release-asc") || sort.equals("added-desc") ? 1L : 10L,
                    result.getFirst().getId());
        }
        ExtendedModelMap page = new ExtendedModelMap();
        controller.anime(session(), page, null, 2, false, "paged", "release-desc");
        @SuppressWarnings("unchecked") List<Anime> pageItems = (List<Anime>) page.get("animeList");
        assertEquals(List.of(2L, 1L, 11L), pageItems.stream().map(Anime::getId).toList());
        verifyNoInteractions(animeOrderService);
    }

    private MockHttpSession session() {
        MockHttpSession session = new MockHttpSession();
        User user = new User();
        user.setId(7L);
        session.setAttribute("loginUser", user);
        return session;
    }
}
