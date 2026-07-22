package com.sekai.draw.lots.mapper;

import com.sekai.draw.lots.dataobject.SekaiDrawLotsPaymentOrderDO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface SekaiDrawLotsPaymentOrderMapper {
    int insert(SekaiDrawLotsPaymentOrderDO record);
    SekaiDrawLotsPaymentOrderDO selectByPrimaryKey(Long id);
    SekaiDrawLotsPaymentOrderDO selectByOrderNo(@Param("orderNo") String orderNo);
    SekaiDrawLotsPaymentOrderDO selectLatestPendingByUserId(@Param("userId") Long userId);
    SekaiDrawLotsPaymentOrderDO selectLatestPendingByUserAndPlan(@Param("userId") Long userId, @Param("planCode") String planCode);
    List<SekaiDrawLotsPaymentOrderDO> selectPending(@Param("limit") int limit);
    List<SekaiDrawLotsPaymentOrderDO> selectRecentByUserId(@Param("userId") Long userId, @Param("limit") int limit);
    int markPaid(@Param("id") Long id, @Param("paidTime") LocalDateTime paidTime);
    int markRejected(@Param("id") Long id);
    int cancelPendingForUser(@Param("orderNo") String orderNo, @Param("userId") Long userId);
}
