package com.sekai.galagame.control;

import com.sekai.galagame.model.GameState;
import com.sekai.galagame.model.Result;
import com.sekai.galagame.model.SaveInfo;
import com.sekai.galagame.model.StoryFrame;
import com.sekai.galagame.model.User;
import com.sekai.galagame.service.GameService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class SaveControl {

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
        Object holder = session.getAttribute(GameControl.SESSION_STATE);
        GameState gs;
        if (holder instanceof GameState casted) {
            gs = casted;
        } else {
            gs = new GameState();
            session.setAttribute(GameControl.SESSION_STATE, gs);
        }
        return gs;
    }

    @PostMapping("/api/save/{slot}")
    public Result<Boolean> save(@PathVariable int slot, HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        return gameService.save(login.getData(), gameState(session), slot);
    }

    @GetMapping("/api/saves")
    public Result<List<SaveInfo>> saves(HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        return gameService.saves(login.getData());
    }

    @PostMapping("/api/load/{slot}")
    public Result<StoryFrame> load(@PathVariable int slot, HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        return gameService.load(login.getData(), gameState(session), slot);
    }

    @DeleteMapping("/api/save/{slot}")
    public Result<Boolean> delete(@PathVariable int slot, HttpSession session) {
        Result<User> login = requireLogin(session);
        if (!login.isSuccess()) {
            return Result.fail(login.getMessage());
        }
        return gameService.deleteSave(login.getData(), slot);
    }
}
