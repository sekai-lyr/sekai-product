package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.*;
import com.sekai.draw.lots.service.ContentService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/admin")
public class AdminControl {
    private final ContentService service;
    public AdminControl(ContentService service) { this.service = service; }
    @GetMapping
    public String index(@RequestParam(required = false) String keyword, @RequestParam(defaultValue = "1") int page, Model model) {
        model.addAttribute("pagination", service.characters(keyword, page));
        model.addAttribute("keyword", keyword);
        model.addAttribute("fortunes", service.fortunes());
        return "admin";
    }
    @GetMapping("/characters/new")
    public String newCharacter(Model model) {
        var c = new AnimeCharacter(); c.setArchetype("main"); c.setPopularity(50);
        model.addAttribute("character", c); return "admin-character";
    }
    @GetMapping("/characters/{id}")
    public String character(@PathVariable Long id, Model model) { model.addAttribute("character", service.character(id)); return "admin-character"; }
    @PostMapping("/characters")
    public String saveCharacter(@ModelAttribute("character") AnimeCharacter character, @RequestParam(defaultValue = "save") String action, Model model, RedirectAttributes redirect) {
        try {
            service.validate(character);
            if ("preview".equals(action)) { model.addAttribute("preview", true); return "admin-character"; }
            service.save(character); redirect.addFlashAttribute("message", "角色已保存"); return "redirect:/admin/characters/" + character.getId();
        } catch (IllegalArgumentException e) { model.addAttribute("error", e.getMessage()); return "admin-character"; }
          catch (org.springframework.dao.DuplicateKeyException e) { model.addAttribute("error", "这个角色名称已存在"); return "admin-character"; }
    }
    @GetMapping("/fortunes/new")
    public String newFortune(Model model) { model.addAttribute("fortune", new ContentFortune()); return "admin-fortune"; }
    @GetMapping("/fortunes/{id}")
    public String fortune(@PathVariable Long id, Model model) { model.addAttribute("fortune", service.fortune(id)); return "admin-fortune"; }
    @PostMapping("/fortunes")
    public String saveFortune(@ModelAttribute("fortune") ContentFortune fortune, @RequestParam(defaultValue = "save") String action, Model model, RedirectAttributes redirect) {
        try {
            service.validate(fortune);
            if ("preview".equals(action)) { model.addAttribute("preview", true); return "admin-fortune"; }
            service.save(fortune); redirect.addFlashAttribute("message", "签文已保存"); return "redirect:/admin/fortunes/" + fortune.getId();
        } catch (IllegalArgumentException e) { model.addAttribute("error", e.getMessage()); return "admin-fortune"; }
          catch (org.springframework.dao.DuplicateKeyException e) { model.addAttribute("error", "这个签文等级已存在"); return "admin-fortune"; }
    }
}
