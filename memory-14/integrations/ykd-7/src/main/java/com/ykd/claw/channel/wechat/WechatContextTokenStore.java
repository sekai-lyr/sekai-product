package com.ykd.claw.channel.wechat;

import java.util.Map;

public interface WechatContextTokenStore {
    void save(String userId, String contextToken);

    Map<String, String> findAll();
}
