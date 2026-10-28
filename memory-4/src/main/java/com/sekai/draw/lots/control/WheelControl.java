package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.*;
import com.sekai.draw.lots.service.WheelService;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
public class WheelControl {
    private final WheelService service;
    public WheelControl(WheelService service) { this.service = service; }
    private User user(HttpSession session) { return (User) session.getAttribute("loginUser"); }
    @GetMapping("/wheel")
    public String wheel(@RequestParam(required = false) Long deckId, HttpSession session, Model model) {
        User user = user(session);
        var deck = service.resolveDeck(user, deckId);
        var options = service.options(user, deck.getId());
        model.addAttribute("deck", deck);
        model.addAttribute("decks", service.decks(user));
        model.addAttribute("options", options);
        model.addAttribute("enabledOptions", options.stream().filter(WheelOption::isEnabled).toList());
        model.addAttribute("recentSpins", service.recentSpins(user, deck.getId(), 8));
        model.addAttribute("suggestions", service.suggestions(user));
        return "wheel";
    }
    @PostMapping("/wheel/decks")
    public String create(@RequestParam String name, HttpSession session, RedirectAttributes redirect) {
        var result = service.createDeck(user(session), name); flash(result, redirect);
        return result.isSuccess() ? "redirect:/wheel?deckId=" + result.getData().getId() : "redirect:/wheel";
    }
    @PostMapping("/wheel/decks/{id}")
    public String rename(@PathVariable Long id, @RequestParam String name, HttpSession session, RedirectAttributes redirect) {
        flash(service.renameDeck(user(session), id, name), redirect); return back(id);
    }
    @PostMapping("/wheel/options")
    public String add(@RequestParam Long deckId, @RequestParam String title, @RequestParam(required = false) String detail,
                      @RequestParam(defaultValue = "1") Integer weight, @RequestParam(required = false) String color, HttpSession session, RedirectAttributes redirect) {
        flash(service.addOption(user(session), deckId, title, detail, weight, color), redirect); return back(deckId);
    }
    @PostMapping("/wheel/options/{id}")
    public String edit(@PathVariable Long id, @RequestParam Long deckId, @RequestParam String title, @RequestParam(required = false) String detail,
                       @RequestParam Integer weight, @RequestParam String color, @RequestParam int sortOrder, @RequestParam(defaultValue = "false") boolean enabled,
                       HttpSession session, RedirectAttributes redirect) {
        flash(service.updateOption(user(session), deckId, id, title, detail, weight, color, sortOrder, enabled), redirect); return back(deckId);
    }
    @PostMapping("/wheel/options/{id}/delete")
    public String delete(@PathVariable Long id, @RequestParam Long deckId, HttpSession session, RedirectAttributes redirect) {
        flash(service.deleteOption(user(session), deckId, id), redirect); return back(deckId);
    }
    @PostMapping("/wheel/import-suggestions")
    public String suggestions(@RequestParam Long deckId, HttpSession session, RedirectAttributes redirect) {
        flash(service.importSuggestions(user(session), deckId), redirect); return back(deckId);
    }
    @PostMapping("/wheel/spin") @ResponseBody
    public Result<WheelSpinResult> spin(@RequestParam Long deckId, HttpSession session) { return service.spin(user(session), deckId); }
    private String back(Long deckId) { return "redirect:/wheel?deckId=" + deckId; }
    private void flash(Result<?> result, RedirectAttributes redirect) {
        redirect.addFlashAttribute(result.isSuccess() ? "message" : "error", result.isSuccess() ? "转盘已更新" : result.getMessage());
    }
}
