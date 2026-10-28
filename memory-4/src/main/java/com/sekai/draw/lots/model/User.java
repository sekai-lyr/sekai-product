package com.sekai.draw.lots.model;

import java.time.LocalDateTime;

public class User {
    private boolean admin = false;
    private int sessionVersion = 0;

    private Long id;
    private String userName;
    private String password;
    private String nickName;
    private String avatar;
    private LocalDateTime createTime;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    @com.fasterxml.jackson.annotation.JsonIgnore
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getNickName() { return nickName; }
    public void setNickName(String nickName) { this.nickName = nickName; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }
    public int getSessionVersion() { return sessionVersion; }
    public void setSessionVersion(int sessionVersion) { this.sessionVersion = sessionVersion; }
}
