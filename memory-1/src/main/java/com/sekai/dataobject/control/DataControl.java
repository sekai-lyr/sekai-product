package com.sekai.dataobject.control;

import com.sekai.dataobject.model.CharacterInfo;
import com.sekai.dataobject.model.Quote;
import com.sekai.dataobject.model.Series;
import com.sekai.dataobject.model.User;
import com.sekai.dataobject.service.CharacterService;
import com.sekai.dataobject.service.QuoteService;
import com.sekai.dataobject.service.SeriesService;
import com.sekai.dataobject.util.UploadPathUtil;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.UUID;

@Controller
public class DataControl {

    @Resource
    private SeriesService seriesService;

    @Resource
    private CharacterService characterService;

    @Resource
    private QuoteService quoteService;

    @PostMapping("/series/add")
    public String addSeries(Series series,
                            @RequestParam(value = "coverFile", required = false) MultipartFile coverFile,
                            HttpSession session,
                            RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        series.setCoverUrl(resolveCoverUrl(series.getCoverUrl(), coverFile));
        boolean success = seriesService.add(series);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "番剧信息已录入二次元数据锡通" : "番剧名称不能为空");
        return "redirect:/series";
    }

    @PostMapping("/series/update/{id}")
    public String updateSeries(@PathVariable Long id,
                               Series series,
                               @RequestParam(value = "coverFile", required = false) MultipartFile coverFile,
                               HttpSession session,
                               RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        series.setId(id);
        series.setCoverUrl(resolveCoverUrl(series.getCoverUrl(), coverFile));
        boolean success = seriesService.update(series);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "番剧信息已更新" : "番剧名称不能为空，或记录不存在");
        return "redirect:/series/" + id;
    }

    @PostMapping("/series/delete/{id}")
    public String deleteSeries(@PathVariable Long id,
                               HttpSession session,
                               RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        seriesService.delete(id);
        redirectAttributes.addFlashAttribute("message", "番剧信息已删除");
        return "redirect:/series";
    }

    @PostMapping("/characters/add")
    public String addCharacter(CharacterInfo characterInfo,
                               @RequestParam(value = "imageFile", required = false) MultipartFile imageFile,
                               HttpSession session,
                               RedirectAttributes redirectAttributes,
                               @RequestParam(value = "returnTo", required = false) String returnTo) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        characterInfo.setImageUrl(resolveImageUrl(characterInfo.getImageUrl(), imageFile));
        boolean success = characterService.add(characterInfo);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "人物信息已录入二次元数据锡通" : "人物名称不能为空");
        return redirectTo(returnTo, "/characters");
    }

    @PostMapping("/characters/update/{id}")
    public String updateCharacter(@PathVariable Long id,
                                  CharacterInfo characterInfo,
                                  @RequestParam(value = "imageFile", required = false) MultipartFile imageFile,
                                  HttpSession session,
                                  RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        characterInfo.setId(id);
        characterInfo.setImageUrl(resolveImageUrl(characterInfo.getImageUrl(), imageFile));
        boolean success = characterService.update(characterInfo);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "人物信息已更新" : "人物名称不能为空，或记录不存在");
        return "redirect:/characters";
    }

    @PostMapping("/characters/delete/{id}")
    public String deleteCharacter(@PathVariable Long id,
                                  HttpSession session,
                                  RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        characterService.delete(id);
        redirectAttributes.addFlashAttribute("message", "人物信息已删除");
        return "redirect:/characters";
    }

    @PostMapping("/quotes/add")
    public String addQuote(Quote quote,
                           @RequestParam(value = "audioFile", required = false) MultipartFile audioFile,
                           HttpSession session,
                           RedirectAttributes redirectAttributes,
                           @RequestParam(value = "returnTo", required = false) String returnTo) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        quote.setAudioUrl(resolveAudioUrl(quote.getAudioUrl(), audioFile));
        if (quote.getCharacterId() != null) {
            CharacterInfo characterInfo = characterService.getById(quote.getCharacterId());
            if (characterInfo != null) {
                quote.setCharacterName(characterInfo.getName());
            }
        }
        boolean success = quoteService.add(quote);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "台词及原音频已收录" : "台词内容不能为空");
        return redirectTo(returnTo, "/quotes");
    }

    @PostMapping("/quotes/update/{id}")
    public String updateQuote(@PathVariable Long id,
                              Quote quote,
                              @RequestParam(value = "audioFile", required = false) MultipartFile audioFile,
                              HttpSession session,
                              RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        quote.setId(id);
        quote.setAudioUrl(resolveAudioUrl(quote.getAudioUrl(), audioFile));
        if (quote.getCharacterId() != null) {
            CharacterInfo characterInfo = characterService.getById(quote.getCharacterId());
            if (characterInfo != null) {
                quote.setCharacterName(characterInfo.getName());
            }
        }
        boolean success = quoteService.update(quote);
        redirectAttributes.addFlashAttribute(success ? "message" : "error",
                success ? "台词记录已更新" : "台词内容不能为空，或记录不存在");
        return "redirect:/quotes";
    }

    @PostMapping("/quotes/delete/{id}")
    public String deleteQuote(@PathVariable Long id,
                              HttpSession session,
                              RedirectAttributes redirectAttributes) {
        if (getLoginUser(session) == null) {
            return "redirect:/login";
        }
        quoteService.delete(id);
        redirectAttributes.addFlashAttribute("message", "台词记录已删除");
        return "redirect:/quotes";
    }

    private User getLoginUser(HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (loginUser instanceof User user) {
            return user;
        }
        return null;
    }

    private String redirectTo(String returnTo, String fallback) {
        if (returnTo != null && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
            return "redirect:" + returnTo;
        }
        return "redirect:" + fallback;
    }

    private String resolveCoverUrl(String submittedUrl, MultipartFile file) {
        String uploadedUrl = saveImage(file);
        return uploadedUrl == null ? submittedUrl : uploadedUrl;
    }

    private String resolveImageUrl(String submittedUrl, MultipartFile file) {
        String uploadedUrl = saveImage(file);
        return uploadedUrl == null ? submittedUrl : uploadedUrl;
    }

    private String saveImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String originalName = file.getOriginalFilename();
        String suffix = ".jpg";
        if (originalName != null && originalName.lastIndexOf('.') >= 0) {
            suffix = originalName.substring(originalName.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        }
        if (!suffix.matches("\\.(jpg|jpeg|png|webp|gif)$")) {
            suffix = ".jpg";
        }
        try {
            Path dir = UploadPathUtil.imageRoot();
            Files.createDirectories(dir);
            Path target = dir.resolve(UUID.randomUUID() + suffix);
            file.transferTo(target);
            return "/uploads/images/" + target.getFileName();
        } catch (IOException ex) {
            return null;
        }
    }

    private String resolveAudioUrl(String submittedUrl, MultipartFile file) {
        String uploadedUrl = saveAudio(file);
        return uploadedUrl == null ? submittedUrl : uploadedUrl;
    }

    private String saveAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String originalName = file.getOriginalFilename();
        String suffix = ".mp3";
        if (originalName != null && originalName.lastIndexOf('.') >= 0) {
            suffix = originalName.substring(originalName.lastIndexOf('.')).toLowerCase(Locale.ROOT);
        }
        if (!suffix.matches("\\.(mp3|wav|ogg|m4a|flac|aac)$")) {
            return null;
        }
        try {
            Path dir = UploadPathUtil.quoteAudioRoot();
            Files.createDirectories(dir);
            Path target = dir.resolve(UUID.randomUUID() + suffix);
            file.transferTo(target);
            return "/uploads/quote-audio/" + target.getFileName();
        } catch (IOException ex) {
            return null;
        }
    }
}
