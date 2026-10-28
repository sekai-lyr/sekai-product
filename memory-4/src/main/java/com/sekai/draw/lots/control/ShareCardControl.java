package com.sekai.draw.lots.control;

import com.sekai.draw.lots.mapper.SekaiDrawLotsRecordMapper;
import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.ShareCardService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@Controller
public class ShareCardControl {
    private final SekaiDrawLotsRecordMapper records;
    private final ShareCardService cards;
    public ShareCardControl(SekaiDrawLotsRecordMapper records, ShareCardService cards) { this.records = records; this.cards = cards; }
    private DrawRecord record(Long id, HttpSession session) {
        User user = (User) session.getAttribute("loginUser");
        var record = records.selectByIdForUser(id, user.getId());
        if (record == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "分享记录不存在");
        return record;
    }
    @GetMapping("/share/records/{id}")
    public String page(@PathVariable Long id, @RequestParam(defaultValue = "night") String theme, @RequestParam(defaultValue = "false") boolean hideName, HttpSession session, Model model) {
        model.addAttribute("record", record(id, session)); model.addAttribute("theme", cards.theme(theme)); model.addAttribute("hideName", hideName);
        return "share";
    }
    @GetMapping("/share/records/{id}.{format}") @ResponseBody
    public ResponseEntity<byte[]> image(@PathVariable Long id, @PathVariable String format, @RequestParam(defaultValue = "night") String theme,
                                        @RequestParam(defaultValue = "false") boolean hideName, @RequestParam(defaultValue = "false") boolean download, HttpSession session) throws java.io.IOException {
        if (!format.equals("svg") && !format.equals("png")) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var record = record(id, session); User user = (User) session.getAttribute("loginUser");
        byte[] content = format.equals("png") ? cards.png(record, user, cards.theme(theme), hideName) : cards.svg(record, user, cards.theme(theme), hideName);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.parseMediaType(format.equals("png") ? "image/png" : "image/svg+xml"))
                .header(HttpHeaders.CONTENT_DISPOSITION, (download ? "attachment" : "inline") + "; filename=sekai-" + id + "." + format).body(content);
    }
}
