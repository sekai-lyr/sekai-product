package com.sekai.song.service.impl;

import com.sekai.song.mapper.SekaiSongUserMapper;
import com.sekai.song.model.Result;
import com.sekai.song.model.User;
import com.sekai.song.service.UserService;
import com.sekai.song.util.PasswordHashUtil;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class UserServiceImpl implements UserService {

    private static final int MIN_PASSWORD_LENGTH = 6;
    private static final int MAX_PASSWORD_LENGTH = 72;

    @Resource
    private SekaiSongUserMapper userMapper;

    private final LoginThrottle throttle = new LoginThrottle(5, TimeUnit.MINUTES.toMillis(15), 4096);

    @Override
    public Result<User> register(User user) {
        if (user == null || isBlank(user.getUserName()) || isBlank(user.getPassword())) {
            return Result.fail("用户名和密码不能为空");
        }
        String password = user.getPassword();
        if (password.length() < MIN_PASSWORD_LENGTH) {
            return Result.fail("密码至少需要 " + MIN_PASSWORD_LENGTH + " 位");
        }
        if (password.length() > MAX_PASSWORD_LENGTH) {
            return Result.fail("密码过长，最多 " + MAX_PASSWORD_LENGTH + " 位");
        }
        if (userMapper.findByUserName(user.getUserName().trim()) != null) {
            return Result.fail("这个用户名已经被占用");
        }
        user.setUserName(user.getUserName().trim());
        if (isBlank(user.getNickName())) {
            user.setNickName(user.getUserName());
        }
        user.setPassword(PasswordHashUtil.hash(password));
        userMapper.insert(user);
        user.setPassword(null);
        return Result.success(user);
    }

    @Override
    public Result<User> login(String userName, String password) {
        if (isBlank(userName) || isBlank(password)) {
            return Result.fail("请输入用户名和密码");
        }
        String throttleKey = userName.trim().toLowerCase(Locale.ROOT);
        long lockedSeconds = throttle.lockedSeconds(throttleKey);
        if (lockedSeconds > 0) {
            long minutes = Math.max(1, TimeUnit.SECONDS.toMinutes(lockedSeconds + 59));
            return Result.fail("尝试次数过多，请 " + minutes + " 分钟后再试");
        }
        User user = userMapper.findByUserName(userName.trim());
        if (user == null || !PasswordHashUtil.matches(password, user.getPassword())) {
            throttle.onFailure(throttleKey);
            return Result.fail("用户名或密码不正确");
        }
        throttle.onSuccess(throttleKey);
        upgradeLegacyHash(user, password);
        user.setPassword(null);
        return Result.success(user);
    }

    private void upgradeLegacyHash(User user, String rawPassword) {
        if (user.getId() == null || !PasswordHashUtil.needsUpgrade(user.getPassword())) {
            return;
        }
        try {
            userMapper.updatePassword(user.getId(), PasswordHashUtil.hash(rawPassword));
        } catch (RuntimeException ignored) {
            // 升级失败不影响登录，下次登录会再尝试
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    static final class LoginThrottle {
        private final int maxFailures;
        private final long windowMillis;
        private final int maxEntries;
        private final LinkedHashMap<String, Attempt> attempts;

        LoginThrottle(int maxFailures, long windowMillis, int maxEntries) {
            this.maxFailures = maxFailures;
            this.windowMillis = windowMillis;
            this.maxEntries = maxEntries;
            this.attempts = new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Attempt> eldest) {
                    return size() > LoginThrottle.this.maxEntries;
                }
            };
        }

        synchronized long lockedSeconds(String key) {
            Attempt attempt = attempts.get(key);
            if (attempt == null || attempt.lockedUntil <= System.currentTimeMillis()) {
                return 0;
            }
            return TimeUnit.MILLISECONDS.toSeconds(attempt.lockedUntil - System.currentTimeMillis());
        }

        synchronized void onFailure(String key) {
            long now = System.currentTimeMillis();
            Attempt attempt = attempts.get(key);
            if (attempt == null || now - attempt.windowStart > windowMillis) {
                attempt = new Attempt(now);
                attempts.put(key, attempt);
            } else {
                attempts.put(key, attempt);
            }
            attempt.failures++;
            if (attempt.failures >= maxFailures) {
                attempt.lockedUntil = now + windowMillis;
                attempt.failures = 0;
                attempt.windowStart = now;
            }
            pruneExpired(now);
        }

        synchronized void onSuccess(String key) {
            attempts.remove(key);
        }

        private void pruneExpired(long now) {
            Iterator<Map.Entry<String, Attempt>> iterator = attempts.entrySet().iterator();
            while (iterator.hasNext()) {
                Attempt attempt = iterator.next().getValue();
                if (attempt.lockedUntil <= now && now - attempt.windowStart > windowMillis) {
                    iterator.remove();
                }
            }
        }

        private static final class Attempt {
            private long windowStart;
            private int failures;
            private long lockedUntil;

            Attempt(long windowStart) {
                this.windowStart = windowStart;
            }
        }
    }
}
