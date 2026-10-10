package com.sekai.world.identity.mapper;

import com.sekai.world.identity.model.UserAccount;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {
    @Select("SELECT id, email, password_hash, display_name FROM sekai_user WHERE email = #{email}")
    UserAccount findByEmail(String email);

    @Select("SELECT id, email, password_hash, display_name FROM sekai_user WHERE id = #{id}")
    UserAccount findById(Long id);

    @Insert("INSERT INTO sekai_user(email, password_hash, display_name) VALUES(#{email}, #{passwordHash}, #{displayName})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insert(UserAccountDraft user);

    class UserAccountDraft {
        private Long id;
        private String email;
        private String passwordHash;
        private String displayName;

        public UserAccountDraft(String email, String passwordHash, String displayName) {
            this.email = email;
            this.passwordHash = passwordHash;
            this.displayName = displayName;
        }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public String getEmail() { return email; }
        public String getPasswordHash() { return passwordHash; }
        public String getDisplayName() { return displayName; }
    }
}
