package com.sekai.picture.mapper;

import com.sekai.picture.dataobject.SekaiPictureWallpaperDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SekaiPictureWallpaperMapper {
    SekaiPictureWallpaperDO findOwned(@Param("id") Long id, @Param("userId") Long userId);
    SekaiPictureWallpaperDO findHash(@Param("userId") Long userId, @Param("hash") String hash);
    List<SekaiPictureWallpaperDO> listTrash(@Param("userId") Long userId);
    List<SekaiPictureWallpaperDO> listUnhashed(@Param("userId") Long userId);
    int setHash(@Param("id") Long id, @Param("hash") String hash);
    int restore(@Param("id") Long id, @Param("userId") Long userId);
    int purge(@Param("id") Long id, @Param("userId") Long userId);
    List<String> listImageUrls();
    com.sekai.picture.model.ArchiveHealth health(@Param("userId") Long userId);
    int countNeeds(@Param("userId") Long userId, @Param("needs") String needs);
    List<SekaiPictureWallpaperDO> listNeeds(@Param("userId") Long userId, @Param("needs") String needs, @Param("offset") int offset, @Param("limit") int limit);
    int insert(SekaiPictureWallpaperDO record);

    SekaiPictureWallpaperDO selectByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    List<SekaiPictureWallpaperDO> listByUserId(@Param("userId") Long userId,
                                            @Param("categoryId") Long categoryId,
                                            @Param("keyword") String keyword,
                                            @Param("onlyFavorite") Boolean onlyFavorite,
                                            @Param("original") Boolean original,
                                            @Param("orientation") String orientation,
                                            @Param("colorTone") String colorTone,
                                            @Param("sort") String sort,
                                            @Param("offset") int offset,
                                            @Param("limit") int limit);

    int countByUserId(@Param("userId") Long userId,
                      @Param("categoryId") Long categoryId,
                      @Param("keyword") String keyword,
                      @Param("onlyFavorite") Boolean onlyFavorite,
                      @Param("original") Boolean original,
                      @Param("orientation") String orientation,
                      @Param("colorTone") String colorTone);

    List<SekaiPictureWallpaperDO> listHotByUserId(@Param("userId") Long userId, @Param("limit") int limit);

    List<String> listColorTonesByUserId(@Param("userId") Long userId);

    SekaiPictureWallpaperDO randomByUserId(@Param("userId") Long userId,
                                           @Param("categoryId") Long categoryId,
                                           @Param("keyword") String keyword,
                                           @Param("onlyFavorite") Boolean onlyFavorite,
                                           @Param("original") Boolean original,
                                           @Param("orientation") String orientation,
                                           @Param("colorTone") String colorTone);

    int updateMeta(SekaiPictureWallpaperDO record);

    int deleteByIdAndUserId(@Param("id") Long id, @Param("userId") Long userId);

    int batchMoveCategory(@Param("userId") Long userId,
                          @Param("ids") List<Long> ids,
                          @Param("categoryId") Long categoryId);

    int countOriginalByUserId(@Param("userId") Long userId);

    Integer sumDownloadCountByUserId(@Param("userId") Long userId);

    int increaseDownloadCount(@Param("id") Long id, @Param("userId") Long userId);
}

