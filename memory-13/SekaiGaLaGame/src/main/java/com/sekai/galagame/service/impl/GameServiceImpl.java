package com.sekai.galagame.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sekai.galagame.dataobject.SekaiGalagameChapterDO;
import com.sekai.galagame.dataobject.SekaiGalagameChoiceDO;
import com.sekai.galagame.dataobject.SekaiGalagameEndingDO;
import com.sekai.galagame.dataobject.SekaiGalagameEndingRecordDO;
import com.sekai.galagame.dataobject.SekaiGalagameGalleryDO;
import com.sekai.galagame.dataobject.SekaiGalagameImageDO;
import com.sekai.galagame.dataobject.SekaiGalagameSaveDO;
import com.sekai.galagame.dataobject.SekaiGalagameStoryNodeDO;
import com.sekai.galagame.mapper.SekaiGalagameChapterMapper;
import com.sekai.galagame.mapper.SekaiGalagameChoiceMapper;
import com.sekai.galagame.mapper.SekaiGalagameEndingMapper;
import com.sekai.galagame.mapper.SekaiGalagameEndingRecordMapper;
import com.sekai.galagame.mapper.SekaiGalagameGalleryMapper;
import com.sekai.galagame.mapper.SekaiGalagameImageMapper;
import com.sekai.galagame.mapper.SekaiGalagameSaveMapper;
import com.sekai.galagame.mapper.SekaiGalagameStoryNodeMapper;
import com.sekai.galagame.model.ChoiceVO;
import com.sekai.galagame.model.EndingVO;
import com.sekai.galagame.model.GameState;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.SaveInfo;
import com.sekai.galagame.model.StoryFrame;
import com.sekai.galagame.model.User;
import com.sekai.galagame.service.GameService;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameServiceImpl implements GameService {

    @Resource
    private SekaiGalagameStoryNodeMapper storyNodeMapper;
    @Resource
    private SekaiGalagameChoiceMapper choiceMapper;
    @Resource
    private SekaiGalagameChapterMapper chapterMapper;
    @Resource
    private SekaiGalagameEndingMapper endingMapper;
    @Resource
    private SekaiGalagameImageMapper imageMapper;
    @Resource
    private SekaiGalagameSaveMapper saveMapper;
    @Resource
    private SekaiGalagameGalleryMapper galleryMapper;
    @Resource
    private SekaiGalagameEndingRecordMapper endingRecordMapper;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, String> imageUrlCache = new ConcurrentHashMap<>();

    @Override
    public StoryFrame start(User user, GameState state, Integer chapterNo) {
        if (chapterNo == null) {
            chapterNo = 0;
        }
        state.setFlags(new LinkedHashMap<>());
        state.setSprites(new ArrayList<>());
        state.setScene(null);
        state.setChapterNo(chapterNo);
        SekaiGalagameChapterDO chapterDO = chapterMapper.selectByChapterNo(chapterNo);
        if (chapterDO == null) {
            chapterDO = chapterMapper.selectByChapterNo(0);
        }
        state.setChapterTitle(chapterDO != null ? chapterDO.getTitle() : "序章");
        return advanceFromLabel(user, state, chapterDO != null ? chapterDO.getStartLabel() : "start");
    }

    @Override
    public StoryFrame advance(User user, GameState state) {
        if (state.getNodeKey() == null) {
            return start(user, state, 0);
        }
        SekaiGalagameStoryNodeDO node = storyNodeMapper.selectByNodeKey(state.getNodeKey());
        if (node == null) {
            return start(user, state, 0);
        }
        if ("menu".equals(node.getNodeType())) {
            return buildFrame(user, state, node);
        }
        return followNext(user, state, node.getNextKey());
    }

    @Override
    public StoryFrame choose(User user, GameState state, String nextKey) {
        if (nextKey == null || nextKey.isBlank()) {
            return buildEndFrame(state, "无效选项");
        }
        return followNext(user, state, nextKey);
    }

    @Override
    public StoryFrame current(User user, GameState state) {
        if (state.getNodeKey() == null) {
            return start(user, state, 0);
        }
        SekaiGalagameStoryNodeDO node = storyNodeMapper.selectByNodeKey(state.getNodeKey());
        if (node == null) {
            return start(user, state, 0);
        }
        return buildFrame(user, state, node);
    }

    @Override
    public Result<Boolean> save(User user, GameState state, int slotNo) {
        if (slotNo < 1 || slotNo > 10) {
            return Result.fail("存档槽位必须在 1-10 之间");
        }
        if (state.getNodeKey() == null) {
            return Result.fail("还没有开始游戏");
        }
        SekaiGalagameStoryNodeDO node = storyNodeMapper.selectByNodeKey(state.getNodeKey());
        if (node != null && "menu".equals(node.getNodeType())) {
            return Result.fail("选项界面不能存档");
        }
        try {
            SekaiGalagameSaveDO saveDO = new SekaiGalagameSaveDO();
            saveDO.setUserId(user.getId());
            saveDO.setSlotNo(slotNo);
            saveDO.setStateJson(objectMapper.writeValueAsString(state));
            saveDO.setChapterNo(state.getChapterNo());
            saveDO.setProgress(buildProgress(state));
            if (saveMapper.selectByUserAndSlot(user.getId(), slotNo) != null) {
                saveMapper.updateBySlot(saveDO);
            } else {
                saveMapper.insert(saveDO);
            }
            return Result.ok(true);
        } catch (Exception e) {
            return Result.fail("存档失败：" + e.getMessage());
        }
    }

    @Override
    public Result<List<SaveInfo>> saves(User user) {
        List<SaveInfo> list = new ArrayList<>();
        List<SekaiGalagameSaveDO> rows = saveMapper.selectByUserId(user.getId());
        for (SekaiGalagameSaveDO row : rows) {
            SaveInfo info = new SaveInfo();
            info.setId(row.getId());
            info.setSlotNo(row.getSlotNo());
            info.setChapterTitle(row.getProgress());
            info.setProgress(row.getProgress());
            info.setUpdateTime(row.getUpdateTime());
            list.add(info);
        }
        return Result.ok(list);
    }

    @Override
    public Result<StoryFrame> load(User user, GameState state, int slotNo) {
        SekaiGalagameSaveDO saveDO = saveMapper.selectByUserAndSlot(user.getId(), slotNo);
        if (saveDO == null) {
            return Result.fail("该存档不存在");
        }
        try {
            GameState loaded = objectMapper.readValue(saveDO.getStateJson(), GameState.class);
            state.setNodeKey(loaded.getNodeKey());
            state.setScene(loaded.getScene());
            state.setSprites(loaded.getSprites() == null ? new ArrayList<>() : loaded.getSprites());
            state.setFlags(loaded.getFlags() == null ? new LinkedHashMap<>() : loaded.getFlags());
            state.setChapterNo(loaded.getChapterNo());
            state.setChapterTitle(loaded.getChapterTitle());
            state.setLabelName(loaded.getLabelName());
            return Result.ok(current(user, state));
        } catch (Exception e) {
            return Result.fail("读档失败：" + e.getMessage());
        }
    }

    @Override
    public Result<Boolean> deleteSave(User user, int slotNo) {
        saveMapper.deleteByUserAndSlot(user.getId(), slotNo);
        return Result.ok(true);
    }

    private StoryFrame advanceFromLabel(User user, GameState state, String labelName) {
        SekaiGalagameStoryNodeDO first = storyNodeMapper.selectFirstOfLabel(labelName);
        if (first == null) {
            return buildEndFrame(state, "未知剧情节点：" + labelName);
        }
        state.setLabelName(labelName);
        return followNext(user, state, first.getNodeKey());
    }

    private StoryFrame followNext(User user, GameState state, String nodeKey) {
        int guard = 0;
        String currentKey = nodeKey;
        while (guard++ < 500) {
            SekaiGalagameStoryNodeDO node = storyNodeMapper.selectByNodeKey(currentKey);
            if (node == null) {
                return buildEndFrame(state, "剧情节点缺失：" + currentKey);
            }
            state.setNodeKey(node.getNodeKey());
            state.setLabelName(node.getLabelName());
            if (node.getChapterNo() != null && node.getChapterNo() >= 0) {
                state.setChapterNo(node.getChapterNo());
                SekaiGalagameChapterDO chapterDO = chapterMapper.selectByChapterNo(node.getChapterNo());
                state.setChapterTitle(chapterDO != null ? chapterDO.getTitle() : "");
            }
            switch (node.getNodeType()) {
                case "scene":
                    applyScene(user, state, node);
                    break;
                case "sprite":
                    applySprites(state, node);
                    break;
                case "set":
                    applySet(state, node);
                    break;
                case "jump":
                    currentKey = node.getNextKey();
                    break;
                case "menu":
                    return buildFrame(user, state, node);
                case "end":
                    return buildEndFrame(user, state, node);
                case "narration":
                case "dialogue":
                default:
                    return buildFrame(user, state, node);
            }
            currentKey = node.getNextKey();
            if (currentKey == null) {
                return buildEndFrame(state, "故事到此结束");
            }
        }
        return buildEndFrame(state, "剧情链条异常");
    }

    private void applyScene(User user, GameState state, SekaiGalagameStoryNodeDO node) {
        state.setScene(node.getBgImage());
        // RenPy 的 scene 语句会清空整个 master 层（立绘全部移除），后续由 show 重新添加
        state.getSprites().clear();
        if (user != null && node.getBgImage() != null) {
            SekaiGalagameImageDO imageDO = imageMapper.selectByKey(node.getBgImage());
            if (imageDO != null && "cg".equals(imageDO.getImageType())) {
                SekaiGalagameGalleryDO galleryDO = new SekaiGalagameGalleryDO();
                galleryDO.setUserId(user.getId());
                galleryDO.setImageKey(node.getBgImage());
                galleryMapper.insertIgnore(galleryDO);
            }
        }
    }

    private void applySprites(GameState state, SekaiGalagameStoryNodeDO node) {
        if (node.getSprites() == null || node.getSprites().isBlank()) {
            return;
        }
        try {
            List<Map<String, String>> items = objectMapper.readValue(node.getSprites(),
                    new TypeReference<List<Map<String, String>>>() {
                    });
            for (Map<String, String> item : items) {
                if (item.containsKey("hide")) {
                    String target = item.get("hide");
                    state.getSprites().removeIf(s -> "all".equals(target)
                            || s.get("image") == null
                            || (s.get("image").startsWith(target + " ") || s.get("image").equals(target)));
                } else {
                    String img = item.get("image");
                    // RenPy 按 tag（image 名第一个单词）替换同角色立绘，例如
                    // show heroine stage_speak 会替换已有的 heroine stage_neutral
                    String tag = img != null && img.contains(" ") ? img.substring(0, img.indexOf(" ")) : img;
                    state.getSprites().removeIf(s -> {
                        String old = s.get("image");
                        if (old == null || tag == null) {
                            return false;
                        }
                        return old.equals(tag) || old.startsWith(tag + " ");
                    });
                    state.getSprites().add(item);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void applySet(GameState state, SekaiGalagameStoryNodeDO node) {
        if (node.getSetVar() != null) {
            state.getFlags().put(node.getSetVar(), node.getSetValue());
        }
    }

    private StoryFrame buildFrame(User user, GameState state, SekaiGalagameStoryNodeDO node) {
        StoryFrame frame = new StoryFrame();
        frame.setNodeKey(node.getNodeKey());
        frame.setNodeType(node.getNodeType());
        frame.setSpeakerName(node.getSpeakerName());
        frame.setText(node.getText());
        frame.setChapterNo(state.getChapterNo());
        frame.setChapterTitle(state.getChapterTitle());
        frame.setLabelName(node.getLabelName());
        frame.setFlags(new LinkedHashMap<>(state.getFlags()));

        if (node.getSpeakerKey() != null && !"narrator".equals(node.getSpeakerKey())) {
            String color = "#ffffff";
            if (node.getSpeakerKey() != null) {
                // 角色颜色由前端按 speaker 名查询；此处留空
            }
            frame.setSpeakerName(node.getSpeakerName());
            frame.setSpeakerColor(color);
        }

        frame.setBgImage(state.getScene());
        frame.setBgUrl(state.getScene() == null ? "" : imageUrl(state.getScene()));
        frame.setSprites(resolveSpriteUrls(state.getSprites()));

        if ("menu".equals(node.getNodeType())) {
            frame.setMenu(true);
            List<ChoiceVO> choices = new ArrayList<>();
            List<SekaiGalagameChoiceDO> rows = choiceMapper.selectByNodeKey(node.getNodeKey());
            for (SekaiGalagameChoiceDO row : rows) {
                ChoiceVO vo = new ChoiceVO();
                vo.setId(row.getId());
                vo.setText(row.getOptionText());
                vo.setNextKey(row.getNextKey() != null ? row.getNextKey() : node.getNextKey());
                choices.add(vo);
            }
            frame.setChoices(choices);
        }
        return frame;
    }

    private StoryFrame buildEndFrame(User user, GameState state, SekaiGalagameStoryNodeDO node) {
        StoryFrame frame = buildFrame(user, state, node);
        frame.setEnd(true);
        if (node.getEndingKey() != null) {
            SekaiGalagameEndingDO endingDO = endingMapper.selectByKey(node.getEndingKey());
            if (endingDO != null) {
                EndingVO vo = new EndingVO();
                vo.setEndingKey(endingDO.getEndingKey());
                vo.setTitle(endingDO.getTitle());
                vo.setDescription(endingDO.getDescription());
                vo.setBgImage(endingDO.getBgImage());
                vo.setBgUrl(endingDO.getBgImage() == null ? "" : imageUrl(endingDO.getBgImage()));
                frame.setEnding(vo);
                if (user != null) {
                    SekaiGalagameEndingRecordDO recordDO = new SekaiGalagameEndingRecordDO();
                    recordDO.setUserId(user.getId());
                    recordDO.setEndingKey(endingDO.getEndingKey());
                    endingRecordMapper.insertIgnore(recordDO);
                }
            }
        }
        return frame;
    }

    private StoryFrame buildEndFrame(GameState state, String message) {
        StoryFrame frame = new StoryFrame();
        frame.setNodeKey("end");
        frame.setNodeType("end");
        frame.setText(message);
        frame.setEnd(true);
        frame.setChapterNo(state.getChapterNo());
        frame.setChapterTitle(state.getChapterTitle());
        frame.setBgImage(state.getScene());
        frame.setBgUrl(state.getScene() == null ? "" : imageUrl(state.getScene()));
        frame.setSprites(resolveSpriteUrls(state.getSprites()));
        frame.setFlags(new LinkedHashMap<>(state.getFlags()));
        return frame;
    }

    private List<Map<String, String>> resolveSpriteUrls(List<Map<String, String>> sprites) {
        List<Map<String, String>> result = new ArrayList<>();
        if (sprites == null) {
            return result;
        }
        for (Map<String, String> s : sprites) {
            Map<String, String> copy = new LinkedHashMap<>(s);
            if (s.get("image") != null) {
                copy.put("url", imageUrl(s.get("image")));
            }
            result.add(copy);
        }
        return result;
    }

    private String buildProgress(GameState state) {
        if (state.getChapterTitle() != null && !state.getChapterTitle().isBlank()) {
            return state.getChapterTitle();
        }
        return "第 " + (state.getChapterNo() + 1) + " 章";
    }

    private String imageUrl(String imageKey) {
        String cached = imageUrlCache.get(imageKey);
        if (cached != null) {
            return cached;
        }
        SekaiGalagameImageDO imageDO = imageMapper.selectByKey(imageKey);
        String url = "/img/" + (imageDO != null ? imageDO.getFilePath() : imageKey);
        imageUrlCache.put(imageKey, url);
        return url;
    }
}
