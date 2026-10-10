package com.sekai.galagame.control;

import com.sekai.galagame.model.GameState;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.StoryFrame;
import com.sekai.galagame.model.User;
import com.sekai.galagame.service.GameService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GameControl {

    public static final String SESSION_STATE = "galagameState";

    @Resource
    private GameService gameService;

    private Result<User> requireLogin(HttpSession session) {
        Object loginUser = session.getAttribute(AuthControl.SESSION_USER);
        if (!(loginUser instanceof User user)) {
            return Result.fail("请先登录");
        }
        return Result.ok(user);
    }

    private GameState gameState(HttpSession session) {
        Object holder = session.getAttribute(SESSION_STATE);
        GameState gs;
        if (holder instanceof GameState casted) {
            gs = casted;
        } else {
            gs = new GameState();
            session.setAttribute(SESSION_STATE, gs);
        }
        return gs;
    }

    @PostMapping("/api/game/start")
    public Result<StoryFrame> start(@RequestParam(value = "chapterNo", required = false) Integer chapterNo,
                                    HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        GameState gameState = gameState(session);
        StoryFrame frame = gameService.start(login.getData(), gameState, chapterNo);
        return Result.ok(frame);
    }

    @GetMapping("/api/game/state")
    public Result<StoryFrame> current(HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        GameState gameState = gameState(session);
        return Result.ok(gameService.current(login.getData(), gameState));
    }

    @PostMapping("/api/game/advance")
    public Result<StoryFrame> advance(HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        GameState gameState = gameState(session);
        return Result.ok(gameService.advance(login.getData(), gameState));
    }

    @PostMapping("/api/game/choose")
    public Result<StoryFrame> choose(@RequestParam String nextKey, HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        GameState gameState = gameState(session);
        return Result.ok(gameService.choose(login.getData(), gameState, nextKey));
    }
}
