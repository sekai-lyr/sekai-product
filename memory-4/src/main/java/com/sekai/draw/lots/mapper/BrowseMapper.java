package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsCharacterDO;
import com.sekai.draw.lots.model.DrawRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Mapper
public interface BrowseMapper {
    List<SekaiDrawLotsCharacterDO> characters(@Param("terms") List<String> terms, @Param("role") String role, @Param("energy") String energy, @Param("offset") int offset, @Param("size") int size);
    int countCharacters(@Param("terms") List<String> terms, @Param("role") String role, @Param("energy") String energy);
    List<String> roles();
    List<String> energies();
    List<DrawRecord> records(@Param("userId") Long userId, @Param("terms") List<String> terms, @Param("mood") String mood, @Param("minScore") Integer minScore,
                             @Param("start") LocalDate start, @Param("end") LocalDate end, @Param("wishId") Long wishId, @Param("offset") int offset, @Param("size") int size);
    int countRecords(@Param("userId") Long userId, @Param("terms") List<String> terms, @Param("mood") String mood, @Param("minScore") Integer minScore,
                     @Param("start") LocalDate start, @Param("end") LocalDate end, @Param("wishId") Long wishId);
    List<Map<String, Object>> calendar(@Param("userId") Long userId, @Param("start") LocalDate start, @Param("end") LocalDate end);
}
