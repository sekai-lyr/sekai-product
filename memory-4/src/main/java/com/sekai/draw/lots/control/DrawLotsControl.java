package com.sekai.draw.lots.control;

import com.sekai.draw.lots.model.DrawRecord;
import com.sekai.draw.lots.model.Result;
import com.sekai.draw.lots.model.RitualResult;
import com.sekai.draw.lots.model.User;
import com.sekai.draw.lots.service.DrawLotsService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DrawLotsControl {

    @Resource
    private DrawLotsService drawLotsService;

    @PostMapping("/draw/roll")
    public Result<DrawRecord> roll(@RequestParam(value = "mood", required = false) String mood,
                                   @RequestParam(value = "wishTopic", required = false) String wishTopic,
                                   @RequestParam(value = "focus", required = false) String focus,
                                   HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return drawLotsService.draw(user, mood, wishTopic, focus);
    }

    @PostMapping("/draw/daily")
    public Result<DrawRecord> daily(@RequestParam(value = "mood", required = false) String mood,
                                    @RequestParam(value = "focus", required = false) String focus,
                                    HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return drawLotsService.dailyDraw(user, mood, focus);
    }

    @PostMapping("/draw/ritual")
    public Result<RitualResult> ritual(@RequestParam(value = "mood", required = false) String mood,
                                       @RequestParam(value = "wishTopic", required = false) String wishTopic,
                                       @RequestParam(value = "focus", required = false) String focus,
                                       HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return drawLotsService.ritualDraw(user, mood, wishTopic, focus);
    }

    @PostMapping("/characters/{id}/favorite")
    public Result<Boolean> favorite(@PathVariable Long id, HttpSession session) {
        Object loginUser = session.getAttribute("loginUser");
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return drawLotsService.toggleFavorite(user, id);
    }
}
