package com.sekai.song.service.impl;

import com.sekai.song.mapper.SekaiSongUserMapper;
import com.sekai.song.model.Result;
import com.sekai.song.model.User;
import com.sekai.song.util.PasswordHashUtil;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UserServiceImplTest {

    private static final String LEGACY_HASH_OF_123456 =
            "fc32e479ff7c6fb690468680fd3b371f620ed7b9b93f259755b1beb8654253a0";

    private final FakeUserMapper mapper = new FakeUserMapper();
    private final UserServiceImpl service = newService();

    private UserServiceImpl newService() {
        UserServiceImpl impl = new UserServiceImpl();
        try {
            Field field = UserServiceImpl.class.getDeclaredField("userMapper");
            field.setAccessible(true);
            field.set(impl, mapper);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return impl;
    }

    private User seed(String name, String storedPassword) {
        User user = new User();
        user.setUserName(name);
        user.setNickName(name);
        user.setPassword(storedPassword);
        mapper.insert(user);
        return user;
    }

    @Test
    void registerStoresSaltedBcryptHash() {
        User input = new User();
        input.setUserName(" listener ");
        input.setPassword("123456");
        Result<User> result = service.register(input);

        assertTrue(result.isSuccess(), result.getMessage());
        String stored = mapper.users.get("listener").getPassword();
        assertTrue(stored.startsWith("$2a$"), stored);
        assertTrue(PasswordHashUtil.matches("123456", stored));
        assertNull(result.getData().getPassword(), "返回对象不应携带哈希");
    }

    @Test
    void registerRejectsShortOrTooLongPassword() {
        User shortPw = new User();
        shortPw.setUserName("a");
        shortPw.setPassword("12345");
        assertFalse(service.register(shortPw).isSuccess());

        User longPw = new User();
        longPw.setUserName("b");
        longPw.setPassword("x".repeat(73));
        assertFalse(service.register(longPw).isSuccess());
    }

    @Test
    void loginUpgradesLegacyHashTransparently() {
        User user = seed("sekai", LEGACY_HASH_OF_123456);

        Result<User> result = service.login("sekai", "123456");

        assertTrue(result.isSuccess(), result.getMessage());
        assertNotNull(mapper.updatedPassword, "旧哈希应在登录成功后被升级");
        assertTrue(mapper.updatedPassword.startsWith("$2a$"), mapper.updatedPassword);
        assertTrue(PasswordHashUtil.matches("123456", mapper.updatedPassword));
        assertEquals(user.getId(), mapper.updatedId);
    }

    @Test
    void loginDoesNotRewriteFreshBcryptHash() {
        seed("sekai", PasswordHashUtil.hash("123456"));

        assertTrue(service.login("sekai", "123456").isSuccess());
        assertNull(mapper.updatedPassword, "新哈希不应每次登录都重写");
    }

    @Test
    void loginLocksAfterRepeatedFailures() {
        seed("sekai", PasswordHashUtil.hash("123456"));

        for (int i = 0; i < 5; i++) {
            assertFalse(service.login("sekai", "wrong-" + i).isSuccess());
        }
        Result<User> locked = service.login("sekai", "123456");
        assertFalse(locked.isSuccess(), "第六次即使密码正确也应被限流拦截");
        assertTrue(locked.getMessage().contains("尝试次数过多"), locked.getMessage());
    }

    @Test
    void loginRejectsUnknownUserWithSameMessage() {
        Result<User> result = service.login("ghost", "123456");
        assertFalse(result.isSuccess());
        assertEquals("用户名或密码不正确", result.getMessage());
    }

    private static final class FakeUserMapper implements SekaiSongUserMapper {
        private final Map<String, User> users = new HashMap<>();
        private long nextId = 1;
        private Long updatedId;
        private String updatedPassword;

        @Override
        public int insert(User user) {
            user.setId(nextId++);
            User stored = new User();
            stored.setId(user.getId());
            stored.setUserName(user.getUserName());
            stored.setNickName(user.getNickName());
            stored.setPassword(user.getPassword());
            users.put(stored.getUserName(), stored);
            return 1;
        }

        @Override
        public User findByUserName(String userName) {
            return users.get(userName);
        }

        @Override
        public User findById(Long id) {
            return users.values().stream()
                    .filter(user -> id.equals(user.getId()))
                    .findFirst()
                    .orElse(null);
        }

        @Override
        public int updatePassword(Long id, String password) {
            updatedId = id;
            updatedPassword = password;
            User user = findById(id);
            if (user != null) {
                user.setPassword(password);
            }
            return 1;
        }
    }
}
