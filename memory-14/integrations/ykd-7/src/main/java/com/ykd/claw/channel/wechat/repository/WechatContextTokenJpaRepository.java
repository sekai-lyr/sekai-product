package com.ykd.claw.channel.wechat.repository;

import com.ykd.claw.channel.wechat.entity.WechatContextTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WechatContextTokenJpaRepository extends JpaRepository<WechatContextTokenEntity, String> {
}
