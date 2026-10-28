package com.sekai.song.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.concurrent.*;

/** Durable input-level progress; successful inputs are never retried. */
@Service
public class ImportTaskService {
    public record Item(String input,String state,String message,int imported,int skipped,List<String> failedInputs) {}
    public record Task(String id,String source,String state,Long playlistId,List<Item> items) {}
    private final JdbcTemplate jdbc;
    private final MusicImportCoordinator importer;
    private final PlaylistService playlists;
    private final ObjectMapper json=new ObjectMapper();
    private final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"music-import-worker");t.setDaemon(true);return t;});
    public ImportTaskService(JdbcTemplate jdbc,MusicImportCoordinator importer,PlaylistService playlists){this.jdbc=jdbc;this.importer=importer;this.playlists=playlists;}
    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        // An interrupted item is explicitly retryable; completed items remain intact.
        jdbc.update("UPDATE sekai_song_import_task SET state='interrupted' WHERE state='running'");
        worker.scheduleWithFixedDelay(this::poll,0,1,TimeUnit.SECONDS);
    }
    @PreDestroy public void close(){worker.shutdownNow();}
    public synchronized String submit(Long userId,String source,String input,Long playlistId) {
        if(!Set.of("netease","qq").contains(source) || input==null || input.isBlank() || input.length()>120000)throw bad("请选择平台，输入最多 120000 字符的链接或歌曲编号");
        if(playlistId!=null && playlists.getByIdAndUserId(playlistId,userId)==null)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"歌单不存在");
        List<String> lines=input.lines().map(String::strip).filter(s->!s.isBlank()).distinct().toList();
        if(lines.size()>5000)throw bad("每个任务最多 5000 行，每行一个链接或歌曲编号");
        if(jdbc.queryForObject("SELECT COUNT(*) FROM sekai_song_import_task WHERE user_id=? AND state IN ('queued','running')",Integer.class,userId)>=3)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"已有 3 个导入任务，请等待完成");
        String id=UUID.randomUUID().toString();long now=System.currentTimeMillis();
        List<Item> items=lines.stream().map(line->new Item(line,"queued","等待处理",0,0,List.of())).toList();
        jdbc.update("INSERT INTO sekai_song_import_task(id,user_id,source,playlist_id,items_json,created_ms,updated_ms) VALUES (?,?,?,?,?,?,?)",id,userId,source,playlistId,encode(items),now,now);
        return id;
    }
    public Task get(Long userId,String id) {
        List<Task> tasks=jdbc.query("SELECT * FROM sekai_song_import_task WHERE id=? AND user_id=?",(rs,n)->new Task(rs.getString("id"),rs.getString("source"),rs.getString("state"),rs.getObject("playlist_id",Long.class),decode(rs.getString("items_json"))),id,userId);
        if(tasks.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"任务不存在");return tasks.get(0);
    }
    public List<Task> list(Long userId) {
        return jdbc.query("SELECT * FROM sekai_song_import_task WHERE user_id=? ORDER BY created_ms DESC LIMIT 20",(rs,n)->new Task(rs.getString("id"),rs.getString("source"),rs.getString("state"),rs.getObject("playlist_id",Long.class),decode(rs.getString("items_json"))),userId);
    }
    public String retry(Long userId,String id) {
        Task task=get(userId,id);
        if(Set.of("queued","running").contains(task.state()))throw bad("任务仍在运行");
        List<String> retry=new ArrayList<>();
        for(Item item:task.items())if(!item.state().equals("complete"))retry.addAll(item.failedInputs().isEmpty()?List.of(item.input()):item.failedInputs());
        if(retry.isEmpty())throw bad("没有失败项需要重试");
        return submit(userId,task.source(),String.join("\n",retry.stream().distinct().toList()),task.playlistId());
    }
    private void poll() {
        try {
            List<Map<String,Object>> rows=jdbc.queryForList("SELECT id,user_id FROM sekai_song_import_task WHERE state='queued' ORDER BY created_ms LIMIT 1");
            if(rows.isEmpty())return;
            String id=(String)rows.get(0).get("id");Long userId=((Number)rows.get(0).get("user_id")).longValue();
            if(jdbc.update("UPDATE sekai_song_import_task SET state='running' WHERE id=? AND state='queued'",id)!=1)return;
            Task task=get(userId,id);List<Item> items=new ArrayList<>(task.items());Long playlistId=task.playlistId();
            for(int i=0;i<items.size();i++) {
                if(Thread.currentThread().isInterrupted())return;
                Item item=items.get(i);
                if(item.state().equals("complete"))continue;
                try {
                    var result=importer.importSongs(task.source(),item.input(),playlistId,userId);
                    if(result.getPlaylistId()!=null)playlistId=result.getPlaylistId();
                    String state=!result.isSuccess()?"failed":result.getFailedInputs().isEmpty()?"complete":"partial";
                    items.set(i,new Item(item.input(),state,result.getMessage(),result.getImportedCount(),result.getSkippedCount(),result.getFailedInputs()));
                } catch(Exception e) {
                    items.set(i,new Item(item.input(),"failed","导入失败，可重试此项",0,0,List.of(item.input())));
                    org.slf4j.LoggerFactory.getLogger(getClass()).warn("Import task {} item {} failed: {}",id,i,e.getClass().getSimpleName());
                }
                jdbc.update("UPDATE sekai_song_import_task SET items_json=?,playlist_id=?,updated_ms=? WHERE id=?",encode(items),playlistId,System.currentTimeMillis(),id);
            }
            jdbc.update("UPDATE sekai_song_import_task SET state=?,updated_ms=? WHERE id=?",items.stream().allMatch(i->i.state().equals("complete"))?"complete":"partial",System.currentTimeMillis(),id);
        } catch(Exception e) {org.slf4j.LoggerFactory.getLogger(getClass()).warn("Import worker unavailable: {}",e.getClass().getSimpleName());}
    }
    private String encode(List<Item> items){try{return json.writeValueAsString(items);}catch(java.io.IOException e){throw new IllegalStateException(e);}}
    private List<Item> decode(String value){try{return json.readValue(value,new TypeReference<List<Item>>(){});}catch(java.io.IOException e){throw new IllegalStateException(e);}}
    private ResponseStatusException bad(String message){return new ResponseStatusException(HttpStatus.BAD_REQUEST,message);}
}
