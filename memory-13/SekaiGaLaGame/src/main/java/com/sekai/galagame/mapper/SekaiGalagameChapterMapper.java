package com.sekai.galagame.mapper;

import com.sekai.galagame.dataobject.SekaiGalagameChapterDO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface SekaiGalagameChapterMapper {
    List<SekaiGalagameChapterDO> selectAll();

    SekaiGalagameChapterDO selectByChapterNo(Integer chapterNo);
}
