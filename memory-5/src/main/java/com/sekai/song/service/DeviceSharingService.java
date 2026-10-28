package com.sekai.song.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Account-scoped device identity; raw credentials are never stored in the database. */
@Service
public class DeviceSharingService {
    private final JdbcTemplate jdbc;
    private final boolean enabled;
    private final SecureRandom random=new SecureRandom();

    public DeviceSharingService(JdbcTemplate jdbc,@Value("${sekai.deviceSharing.enabled:false}") boolean enabled) {
        this.jdbc=jdbc;this.enabled=enabled;
    }
    public record Pairing(String code,int expiresInSeconds) {}
    public record Credentials(String deviceId,String token) {}
    public record Device(String id,String name,boolean revoked,boolean online,boolean sharing) {}

    @Transactional
    public Credentials browserDevice(Long userId,String id) {
        requireEnabled();authenticatedUser(userId);
        if(jdbc.queryForList("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if(id!=null){
            requireOwnedDevice(userId,id);String token=secret();
            jdbc.update("UPDATE sekai_song_device SET token_hash=? WHERE id=? AND user_id=?",digest(token),id,userId);
            return new Credentials(id,token);
        }
        return pair(createPairing(userId).code(),"浏览器共享电脑");
    }

    private void requireEnabled() {
        if(!enabled)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"设备共享尚未启用");
    }
    private String secret() {
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private static String digest(String value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
    private static boolean validSecret(String value){return value!=null && value.matches("[A-Za-z0-9_-]{43}");}
    private static void authenticatedUser(Long userId){if(userId==null || userId<=0)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);}

    @Transactional
    public Pairing createPairing(Long userId) {
        requireEnabled();authenticatedUser(userId);
        // Serialize creation against the owning account to enforce limits under concurrency.
        if(jdbc.queryForList("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        jdbc.update("DELETE FROM sekai_song_device_pairing WHERE user_id=? AND expires_at<=UTC_TIMESTAMP()",userId);
        if(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_device_pairing WHERE user_id=?",Integer.class,userId)>=5)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"请等待已有配对码过期");
        String code=secret();
        jdbc.update("INSERT INTO sekai_song_device_pairing(code_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 5 MINUTE))",digest(code),userId);
        return new Pairing(code,300);
    }
    @Transactional
    public Credentials pair(String code,String name) {
        requireEnabled();
        if(!validSecret(code))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"配对凭证无效或已过期");
        if(name==null || name.isBlank() || name.length()>80 || name.codePoints().anyMatch(Character::isISOControl))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"设备名称不合法");
        var owners=jdbc.queryForList("SELECT user_id FROM sekai_song_device_pairing WHERE code_hash=? AND expires_at>UTC_TIMESTAMP()",Long.class,digest(code));
        if(owners.size()!=1)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"配对凭证无效或已过期");
        Long userId=owners.get(0);
        jdbc.queryForList("SELECT id FROM sekai_song_user WHERE id=? FOR UPDATE",Long.class,userId);
        if(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_device WHERE user_id=? AND revoked=FALSE",Integer.class,userId)>=8)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"请先撤销不再使用的设备");
        if(jdbc.update("DELETE FROM sekai_song_device_pairing WHERE code_hash=? AND expires_at>UTC_TIMESTAMP()",digest(code))!=1)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        String id=UUID.randomUUID().toString(),token=secret();
        jdbc.update("INSERT INTO sekai_song_device(id,user_id,name,token_hash) VALUES (?,?,?,?)",id,userId,name.strip(),digest(token));
        return new Credentials(id,token);
    }
    public Long authenticate(String id,String token) {
        requireEnabled();
        if(id==null || !id.matches("[0-9a-f-]{36}") || !validSecret(token))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        var rows=jdbc.queryForList("SELECT user_id,token_hash FROM sekai_song_device WHERE id=? AND revoked=FALSE",id);
        if(rows.size()!=1 || !MessageDigest.isEqual(digest(token).getBytes(StandardCharsets.US_ASCII),
                rows.get(0).get("token_hash").toString().getBytes(StandardCharsets.US_ASCII)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return ((Number)rows.get(0).get("user_id")).longValue();
    }
    public List<Device> list(Long userId) {
        requireEnabled();authenticatedUser(userId);
        return jdbc.query("SELECT id,name,revoked FROM sekai_song_device WHERE user_id=? ORDER BY created_at,id",
                (rs,n)->new Device(rs.getString("id"),rs.getString("name"),rs.getBoolean("revoked"),false,false),userId);
    }
    public void revoke(Long userId,String id) {
        requireEnabled();authenticatedUser(userId);
        if(jdbc.update("UPDATE sekai_song_device SET revoked=TRUE WHERE id=? AND user_id=?",id,userId)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    public java.util.Set<Long> songIds(Long userId) {
        requireEnabled();
        return new java.util.HashSet<>(jdbc.queryForList("SELECT id FROM sekai_song_track WHERE user_id=?",Long.class,userId));
    }
    public void requireOwnedSong(Long userId,Long songId) {
        requireEnabled();
        if(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_track WHERE id=? AND user_id=?",Integer.class,songId,userId)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    public void requireOwnedDevice(Long userId,String id) {
        requireEnabled();
        if(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_device WHERE id=? AND user_id=? AND revoked=FALSE",Integer.class,id,userId)!=1)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    public boolean active(String id) {
        requireEnabled();return jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_device WHERE id=? AND revoked=FALSE",Integer.class,id)==1;
    }
}
