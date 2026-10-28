package com.sekai.song.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocalLibraryServiceTest {
    @Test void videoReferencesAcceptSupportedContainersButRejectPaths(){
        try(var factory=jakarta.validation.Validation.buildDefaultValidatorFactory()){
            var validator=factory.getValidator();
            for(String name:java.util.List.of("movie.mp4","movie.webm","movie.MOV","song.flac"))
                assertTrue(validator.validate(new LocalLibraryService.FileReference(name,100L,1L,null)).isEmpty());
            for(String name:java.util.List.of("../movie.mp4","C:\\movie.mp4","movie.exe"))
                assertFalse(validator.validate(new LocalLibraryService.FileReference(name,100L,1L,null)).isEmpty());
        }
    }
    @Test void anotherUsersSongCannotBeBoundOrDeletedOrHavePreferencesWritten(){
        var service=new LocalLibraryService();var songs=mock(SongService.class);var jdbc=mock(JdbcTemplate.class);
        ReflectionTestUtils.setField(service,"songs",songs);ReflectionTestUtils.setField(service,"jdbc",jdbc);
        var file=new LocalLibraryService.FileReference("song.flac",100L,1L,null);
        assertEquals(404,assertThrows(ResponseStatusException.class,()->service.bind(36L,99L,file)).getStatusCode().value());
        assertEquals(404,assertThrows(ResponseStatusException.class,()->service.delete(36L,99L)).getStatusCode().value());
        assertEquals(404,assertThrows(ResponseStatusException.class,()->service.preferences(36L,99L,null)).getStatusCode().value());
        verifyNoInteractions(jdbc);
    }
}
