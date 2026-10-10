package com.sekai.game.repository;

import com.sekai.game.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);

    /**
     * 条件式原子扣费：只有余额足够时才会扣减并返回 1，否则返回 0。
     * 直接"读余额 → 判断 → 写回"在并发请求下会让两次开包都通过检查（双花/丢更新）。
     * clearAutomatically 让持久化上下文失效，调用方必须重新读取用户实体。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.duelCoins = u.duelCoins - :cost where u.id = :userId and u.duelCoins >= :cost")
    int spendDuelCoins(@Param("userId") Long userId, @Param("cost") int cost);

    /** 给用户加币（奖励结算等），同样是原子操作。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update User u set u.duelCoins = u.duelCoins + :amount where u.id = :userId")
    int addDuelCoins(@Param("userId") Long userId, @Param("amount") int amount);
}
