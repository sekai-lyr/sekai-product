package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.model.AnimeCharacter;
import com.sekai.draw.lots.model.ContentFortune;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import java.util.List;

@Mapper
public interface ContentMapper {
    List<AnimeCharacter> characters(@Param("keyword") String keyword, @Param("offset") int offset);
    int countCharacters(@Param("keyword") String keyword);
    AnimeCharacter character(Long id);
    int insertCharacter(AnimeCharacter character);
    int updateCharacter(AnimeCharacter character);
    List<ContentFortune> fortunes();
    ContentFortune fortune(Long id);
    int insertFortune(ContentFortune fortune);
    int updateFortune(ContentFortune fortune);
}
