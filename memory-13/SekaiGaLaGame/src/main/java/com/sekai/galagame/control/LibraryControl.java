package com.sekai.galagame.control;

import com.sekai.galagame.dataobject.SekaiGalagameChapterDO;
import com.sekai.galagame.dataobject.SekaiGalagameCharacterDO;
import com.sekai.galagame.dataobject.SekaiGalagameEndingDO;
import com.sekai.galagame.dataobject.SekaiGalagameEndingRecordDO;
import com.sekai.galagame.dataobject.SekaiGalagameGalleryDO;
import com.sekai.galagame.dataobject.SekaiGalagameImageDO;
import com.sekai.galagame.mapper.SekaiGalagameChapterMapper;
import com.sekai.galagame.mapper.SekaiGalagameCharacterMapper;
import com.sekai.galagame.mapper.SekaiGalagameEndingMapper;
import com.sekai.galagame.mapper.SekaiGalagameEndingRecordMapper;
import com.sekai.galagame.mapper.SekaiGalagameGalleryMapper;
import com.sekai.galagame.mapper.SekaiGalagameImageMapper;
import com.sekai.galagame.model.EndingVO;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.User;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
public class LibraryControl {

    @Resource
    private SekaiGalagameChapterMapper chapterMapper;
    @Resource
    private SekaiGalagameEndingMapper endingMapper;
    @Resource
    private SekaiGalagameEndingRecordMapper endingRecordMapper;
    @Resource
    private SekaiGalagameGalleryMapper galleryMapper;
    @Resource
    private SekaiGalagameImageMapper imageMapper;
    @Resource
    private SekaiGalagameCharacterMapper characterMapper;

    private User loginUser(HttpSession session) {
        Object loginUser = session.getAttribute(AuthControl.SESSION_USER);
        if (loginUser instanceof User user) {
            return user;
        }
        return null;
    }

    @GetMapping("/api/chapters")
    public Result<List<SekaiGalagameChapterDO>> chapters() {
        return Result.ok(chapterMapper.selectAll());
    }

    @GetMapping("/api/characters")
    public Result<List<SekaiGalagameCharacterDO>> characters() {
        return Result.ok(characterMapper.selectAll());
    }

    @GetMapping("/api/images")
    public Result<Map<String, String>> images() {
        Map<String, String> map = new HashMap<>();
        for (SekaiGalagameImageDO image : imageMapper.selectAll()) {
            map.put(image.getImageKey(), "/img/" + image.getFilePath());
        }
        return Result.ok(map);
    }

    @GetMapping("/api/endings")
    public Result<List<EndingVO>> endings(HttpSession session) {
        User user = loginUser(session);
        List<SekaiGalagameEndingDO> endings = endingMapper.selectAll();
        Set<String> unlocked = user == null ? Set.of()
                : endingRecordMapper.selectByUserId(user.getId()).stream()
                .map(SekaiGalagameEndingRecordDO::getEndingKey).collect(Collectors.toSet());
        List<EndingVO> list = new ArrayList<>();
        for (SekaiGalagameEndingDO ending : endings) {
            EndingVO vo = new EndingVO();
            vo.setEndingKey(ending.getEndingKey());
            vo.setTitle(ending.getTitle());
            vo.setDescription(ending.getDescription());
            vo.setBgImage(ending.getBgImage());
            vo.setBgUrl(ending.getBgImage() == null ? "" : "/img/" + ending.getBgImage());
            vo.setUnlocked(unlocked.contains(ending.getEndingKey()));
            list.add(vo);
        }
        return Result.ok(list);
    }

    @GetMapping("/api/gallery")
    public Result<List<Map<String, Object>>> gallery(HttpSession session) {
        User user = loginUser(session);
        if (user == null) {
            return Result.fail("请先登录");
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (SekaiGalagameGalleryDO row : galleryMapper.selectByUserId(user.getId())) {
            SekaiGalagameImageDO image = imageMapper.selectByKey(row.getImageKey());
            if (image == null) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("imageKey", row.getImageKey());
            item.put("url", "/img/" + image.getFilePath());
            item.put("unlockTime", row.getUnlockTime());
            list.add(item);
        }
        return Result.ok(list);
    }

    @GetMapping("/api/gallery/all")
    public Result<List<Map<String, Object>>> galleryAll() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (SekaiGalagameImageDO image : imageMapper.selectByType("cg")) {
            Map<String, Object> item = new HashMap<>();
            item.put("imageKey", image.getImageKey());
            item.put("url", "/img/" + image.getFilePath());
            item.put("unlocked", false);
            list.add(item);
        }
        return Result.ok(list);
    }
}
