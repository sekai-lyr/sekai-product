package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.LocalLibraryService;
import com.sekai.song.service.PlaylistService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.Validation;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocalLibraryControlTest {
    @Test void anonymousAndForgedCsrfCannotSaveAnyFields(){
        var controller=new LocalLibraryControl();var library=mock(LocalLibraryService.class);
        ReflectionTestUtils.setField(controller,"library",library);
        var ref=new LocalLibraryService.FileReference("song.flac",1024L,1L,null);
        assertEquals(401,assertThrows(ResponseStatusException.class,()->controller.bind(36L,ref,new MockHttpSession(),null)).getStatusCode().value());
        var session=session(3L);session.setAttribute("localLibraryCsrf","valid");
        assertEquals(403,assertThrows(ResponseStatusException.class,()->controller.bind(36L,ref,session,"wrong")).getStatusCode().value());
        verifyNoInteractions(library);
    }
    @Test void callerCannotSupplyAnotherOwnerId(){
        var controller=new LocalLibraryControl();var library=mock(LocalLibraryService.class);
        ReflectionTestUtils.setField(controller,"library",library);
        var session=session(3L);session.setAttribute("localLibraryCsrf","valid");
        var ref=new LocalLibraryService.FileReference("song.flac",1024L,1L,null);
        controller.bind(36L,ref,session,"valid");verify(library).bind(36L,3L,ref);
    }
    @Test void listingAlwaysUsesSessionOwner(){
        var controller=new LocalLibraryControl();var library=mock(LocalLibraryService.class);var playlists=mock(PlaylistService.class);
        ReflectionTestUtils.setField(controller,"library",library);ReflectionTestUtils.setField(controller,"playlists",playlists);
        when(library.list(3L)).thenReturn(List.of());when(playlists.listByUserId(3L)).thenReturn(List.of());
        assertTrue(controller.list(session(3L)).containsKey("csrf"));verify(library).list(3L);verify(playlists).listByUserId(3L);
    }
    @Test void metadataCannotContainPathsNegativeSizesOrHugeBookmarks(){
        try(var factory=Validation.buildDefaultValidatorFactory()){
            var validator=factory.getValidator();
            assertTrue(validator.validate(new LocalLibraryService.FileReference("song.flac",1024L,1L,null)).isEmpty());
            for(String name:List.of("../../song.flac","C:\\music\\song.flac","http://host/song.mp3","audio.bin"))
                assertFalse(validator.validate(new LocalLibraryService.FileReference(name,1024L,1L,null)).isEmpty());
            assertFalse(validator.validate(new LocalLibraryService.FileReference("song.flac",-1L,1L,null)).isEmpty());
            assertFalse(validator.validate(new LocalLibraryService.Preferences("disc","sequence",1,1,0,
                    java.util.Collections.nCopies(31,new LocalLibraryService.Bookmark(1,"test")),null,null)).isEmpty());
        }
    }
    private MockHttpSession session(Long id){var session=new MockHttpSession();var user=new User();user.setId(id);user.setUserName("test");session.setAttribute("loginUser",user);return session;}
}
