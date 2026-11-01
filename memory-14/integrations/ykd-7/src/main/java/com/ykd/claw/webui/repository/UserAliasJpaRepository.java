package com.ykd.claw.webui.repository;

import com.ykd.claw.webui.entity.UserAliasEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAliasJpaRepository extends JpaRepository<UserAliasEntity, String> {
}
