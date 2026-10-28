package com.sekai.song.service;

import jakarta.annotation.Resource;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class WebsiteFeedbackService {
    @Resource private JdbcTemplate jdbc;
    @org.springframework.beans.factory.annotation.Value("${sekai.website.admin-user-id:3}") private Long adminId;
    public record Review(@NotBlank @Size(min=2,max=1000) String content,@Min(1) Long parentId,@Min(1) Long replyToId) {}
    public record Like(@NotNull Boolean liked) {}
    public record Moderation(@NotBlank @Pattern(regexp="approved|rejected") String status) {}
    public record Start(@NotNull @Min(1) Long songId,@NotBlank @Pattern(regexp=com.sekai.song.model.StageModes.PATTERN) String stage) {}
    public record Heartbeat(@Min(0) @Max(86400000) long cumulativeMs,
                            @NotBlank @Pattern(regexp=com.sekai.song.model.StageModes.PATTERN) String stage) {}
    private LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Shanghai"));}
    private long count(String sql,Object...args){Long value=jdbc.queryForObject(sql,Long.class,args);return value==null?0:value;}

    @Transactional
    public long submit(Long userId,Review input){
        if(input.parentId()!=null){
            if(count("SELECT COUNT(*) FROM sekai_song_feedback WHERE id=? AND status='approved' AND parent_id IS NULL",input.parentId())==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"原评论不可用");
            if(input.replyToId()!=null && count("SELECT COUNT(*) FROM sekai_song_feedback WHERE id=? AND status='approved' AND (parent_id=? OR (id=? AND parent_id IS NULL))",input.replyToId(),input.parentId(),input.parentId())==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"回复对象不在此评论中");
        }else if(input.replyToId()!=null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        // Serialize submissions for this existing user without modifying the user row.
        jdbc.queryForObject("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId);
        long now=System.currentTimeMillis();
        if(count("SELECT COUNT(*) FROM sekai_song_feedback WHERE user_id=? AND created_ms>?",userId,now-60000)>0)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"每分钟最多提交一次评价");
        String content=input.content().trim();
        if(content.length()<2)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"请写至少2个字符");
        var key=new org.springframework.jdbc.support.GeneratedKeyHolder();
        jdbc.update(connection->{var statement=connection.prepareStatement("INSERT INTO sekai_song_feedback(user_id,content,created_ms,parent_id,reply_to_id) VALUES (?,?,?,?,?)",java.sql.Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1,userId);statement.setString(2,content);statement.setLong(3,now);statement.setObject(4,input.parentId());statement.setObject(5,input.replyToId());return statement;},key);
        return Objects.requireNonNull(key.getKey()).longValue();
    }
    public List<Map<String,Object>> reviews(String status,Long owner,int page){
        String filter=owner!=null?"f.user_id=?":"f.status=?";
        return jdbc.queryForList("SELECT f.id,COALESCE(NULLIF(u.nick_name,''),'音乐爱好者') AS author,f.content,f.status,f.created_ms AS createdMs,f.parent_id AS parentId,f.reply_to_id AS replyToId,(f.user_id=?) AS isAdmin,EXISTS(SELECT 1 FROM sekai_song_feedback p WHERE p.id=f.parent_id AND p.status='approved') AS parentVisible FROM sekai_song_feedback f LEFT JOIN sekai_song_user u ON u.id=f.user_id WHERE "+filter+" ORDER BY f.id DESC LIMIT 20 OFFSET ?",adminId,owner!=null?owner:status,page*20);
    }
    private String publicColumns(){return "SELECT f.id,COALESCE(NULLIF(u.nick_name,''),'音乐爱好者') AS author,f.content,f.status,f.created_ms AS createdMs,f.parent_id AS parentId,f.reply_to_id AS replyToId,COALESCE(tu.nick_name,'') AS replyToAuthor,(f.user_id=?) AS isAdmin,(SELECT COUNT(*) FROM sekai_song_feedback_like l WHERE l.feedback_id=f.id) AS likeCount,EXISTS(SELECT 1 FROM sekai_song_feedback_like l WHERE l.feedback_id=f.id AND l.user_id=?) AS liked,(SELECT COUNT(*) FROM sekai_song_feedback r WHERE r.parent_id=f.id AND r.status='approved') AS replyCount FROM sekai_song_feedback f LEFT JOIN sekai_song_user u ON u.id=f.user_id LEFT JOIN sekai_song_feedback target ON target.id=f.reply_to_id LEFT JOIN sekai_song_user tu ON tu.id=target.user_id ";}
    public List<Map<String,Object>> publicReviews(Long viewer,int page,String sort){
        return jdbc.queryForList(publicColumns()+"WHERE f.status='approved' AND f.parent_id IS NULL ORDER BY "+("hot".equals(sort)?"likeCount DESC,":"")+"f.id DESC LIMIT 20 OFFSET ?",adminId,viewer==null?0L:viewer,page*20);
    }
    private void requirePublic(long id){if(count("SELECT COUNT(*) FROM sekai_song_feedback f WHERE f.id=? AND f.status='approved' AND (f.parent_id IS NULL OR EXISTS(SELECT 1 FROM sekai_song_feedback p WHERE p.id=f.parent_id AND p.status='approved'))",id)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
    public List<Map<String,Object>> replies(long root,Long viewer,int page){
        if(count("SELECT COUNT(*) FROM sekai_song_feedback WHERE id=? AND status='approved' AND parent_id IS NULL",root)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return jdbc.queryForList(publicColumns()+"WHERE f.parent_id=? AND f.status='approved' ORDER BY f.id LIMIT 10 OFFSET ?",adminId,viewer==null?0L:viewer,root,page*10);
    }
    @Transactional public Map<String,Object> like(long id,Long userId,boolean liked){
        requirePublic(id);
        if(liked)jdbc.update("INSERT IGNORE INTO sekai_song_feedback_like(feedback_id,user_id) VALUES (?,?)",id,userId);
        else jdbc.update("DELETE FROM sekai_song_feedback_like WHERE feedback_id=? AND user_id=?",id,userId);
        return Map.of("liked",liked,"likeCount",count("SELECT COUNT(*) FROM sekai_song_feedback_like WHERE feedback_id=?",id));
    }
    public Map<String,Object> community(){return Map.of("comments",count("SELECT COUNT(*) FROM sekai_song_feedback WHERE status='approved' AND parent_id IS NULL"),"replies",count("SELECT COUNT(*) FROM sekai_song_feedback f WHERE f.status='approved' AND f.parent_id IS NOT NULL AND EXISTS(SELECT 1 FROM sekai_song_feedback p WHERE p.id=f.parent_id AND p.status='approved')"),"participants",count("SELECT COUNT(DISTINCT user_id) FROM sekai_song_feedback f WHERE status='approved' AND (parent_id IS NULL OR EXISTS(SELECT 1 FROM sekai_song_feedback p WHERE p.id=f.parent_id AND p.status='approved'))"));}
    public void moderate(long id,String status){if(jdbc.update("UPDATE sekai_song_feedback SET status=?,reviewed_ms=? WHERE id=?",status,System.currentTimeMillis(),id)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);}
    public void login(Long userId){
        jdbc.update("INSERT INTO sekai_song_login_daily(user_id,day,login_count,last_ms) VALUES (?,?,1,?) ON DUPLICATE KEY UPDATE login_count=login_count+1,last_ms=VALUES(last_ms)",userId,today(),System.currentTimeMillis());
    }
    public String start(Long userId,Start input){
        if(count("SELECT COUNT(*) FROM sekai_song_track WHERE id=? AND user_id=?",input.songId(),userId)==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        long now=System.currentTimeMillis();
        if(count("SELECT COUNT(*) FROM sekai_song_listen_session WHERE user_id=? AND last_ms>? AND played_ms=0",userId,now-60000)>=10)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
        String id=UUID.randomUUID().toString();
        jdbc.update("INSERT INTO sekai_song_listen_session(id,user_id,song_id,start_day,last_ms) VALUES (?,?,?,?,?)",id,userId,input.songId(),today(),now);return id;
    }
    @Transactional
    public long heartbeat(Long userId,String id,Heartbeat input){
        var sessions=jdbc.queryForList("SELECT reported_ms,last_ms FROM sekai_song_listen_session WHERE id=? AND user_id=? FOR UPDATE",id,userId);
        if(sessions.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var session=sessions.get(0);long reported=((Number)session.get("reported_ms")).longValue(),now=System.currentTimeMillis();
        if(input.cumulativeMs()<=reported)return 0;
        long delta=Math.min(input.cumulativeMs()-reported,Math.min(30000,Math.max(0,now-((Number)session.get("last_ms")).longValue())));
        jdbc.update("UPDATE sekai_song_listen_session SET reported_ms=?,last_ms=?,played_ms=played_ms+? WHERE id=? AND user_id=?",input.cumulativeMs(),now,delta,id,userId);
        if(delta>0)jdbc.update("INSERT INTO sekai_song_listen_daily(user_id,day,stage,played_ms) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE played_ms=played_ms+VALUES(played_ms)",userId,today(),input.stage(),delta);
        return delta;
    }
    public Map<String,Object> overview(){
        LocalDate day=today();
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("registeredUsers",count("SELECT COUNT(*) FROM sekai_song_user"));
        result.put("todayLogins",count("SELECT COUNT(*) FROM sekai_song_login_daily WHERE day=?",day));
        result.put("active7Days",count("SELECT COUNT(DISTINCT user_id) FROM (SELECT user_id FROM sekai_song_login_daily WHERE day>=? UNION SELECT user_id FROM sekai_song_listen_daily WHERE day>=?) a",day.minusDays(6),day.minusDays(6)));
        result.put("recentActive",count("SELECT COUNT(DISTINCT user_id) FROM (SELECT user_id FROM sekai_song_login_daily WHERE last_ms>? UNION SELECT user_id FROM sekai_song_listen_session WHERE last_ms>?) a",System.currentTimeMillis()-300000,System.currentTimeMillis()-300000));
        result.put("plays",count("SELECT COUNT(*) FROM sekai_song_listen_session WHERE played_ms>=5000"));
        result.put("songsHeard",count("SELECT COUNT(DISTINCT song_id) FROM sekai_song_listen_session WHERE played_ms>=5000"));
        result.put("playedMs",count("SELECT COALESCE(SUM(played_ms),0) FROM sekai_song_listen_daily"));
        result.put("todayPlayedMs",count("SELECT COALESCE(SUM(played_ms),0) FROM sekai_song_listen_daily WHERE day=?",day));
        result.put("comments",count("SELECT COUNT(*) FROM sekai_song_feedback"));
        for(String status:List.of("pending","approved","rejected"))result.put(status,count("SELECT COUNT(*) FROM sekai_song_feedback WHERE status=?",status));
        List<Map<String,Object>> trend=new ArrayList<>();
        for(int i=6;i>=0;i--){LocalDate date=day.minusDays(i);trend.add(Map.of("day",date.toString(),"logins",count("SELECT COUNT(*) FROM sekai_song_login_daily WHERE day=?",date),"playedMs",count("SELECT COALESCE(SUM(played_ms),0) FROM sekai_song_listen_daily WHERE day=?",date)));}
        result.put("trend",trend);result.put("stages",jdbc.queryForList("SELECT stage,SUM(played_ms) AS playedMs FROM sekai_song_listen_daily GROUP BY stage"));
        result.put("trackingStarted",jdbc.queryForObject("SELECT MIN(day) FROM (SELECT day FROM sekai_song_login_daily UNION ALL SELECT day FROM sekai_song_listen_daily) a",String.class));
        return result;
    }
    public String export(){
        StringBuilder csv=new StringBuilder("\uFEFF编号,昵称,所属主评论编号,回复对象编号,评论,状态,提交时间（北京时间）\r\n");
        jdbc.query("SELECT f.id,COALESCE(u.nick_name,'音乐爱好者') AS author,f.parent_id,f.reply_to_id,f.content,f.status,f.created_ms FROM sekai_song_feedback f LEFT JOIN sekai_song_user u ON u.id=f.user_id ORDER BY f.id DESC LIMIT 10000",(org.springframework.jdbc.core.RowCallbackHandler)rs->{
            try{for(int i=1;i<=7;i++){if(i>1)csv.append(',');String cell=i==7?java.time.Instant.ofEpochMilli(rs.getLong(i)).atZone(ZoneId.of("Asia/Shanghai")).toLocalDateTime().toString():Objects.toString(rs.getObject(i),"");String trimmed=cell.stripLeading();if(!trimmed.isEmpty() && "=+@-".indexOf(trimmed.charAt(0))>=0)cell="'"+cell;csv.append('"').append(cell.replace("\"","\"\"")).append('"');}csv.append("\r\n");}catch(java.sql.SQLException error){throw new IllegalStateException(error);}
        });return csv.toString();
    }
}
