package com.sekai.song.control;

import com.sekai.song.model.User;
import com.sekai.song.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;

@Controller
public class LibraryToolsControl {
    private final LibraryQueryService queries;
    private final LibraryArchiveService archives;
    private final LibraryMergeService merges;
    private final ImportTaskService tasks;
    private final ObjectMapper json=new ObjectMapper();
    public LibraryToolsControl(LibraryQueryService queries,LibraryArchiveService archives,LibraryMergeService merges,ImportTaskService tasks){this.queries=queries;this.archives=archives;this.merges=merges;this.tasks=tasks;}
    @GetMapping("/library-tools")
    public String page(HttpSession session,Model model) {
        if(!(session.getAttribute("loginUser") instanceof User user))return "redirect:/login";
        model.addAttribute("loginUser",user);model.addAttribute("libraryCsrf",token(session));return "library-tools";
    }
    @GetMapping("/api/library-tools/session") @ResponseBody
    public Map<String,String> session(HttpSession session){user(session);return Map.of("csrf",token(session));}
    @GetMapping("/api/library-tools/smart") @ResponseBody
    public Map<String,Object> smart(HttpSession session,@RequestParam(defaultValue="recent") String rule,@RequestParam(defaultValue="1") int page) {
        if(!Set.of("recent","frequent","missing-lyrics","unlinked").contains(rule))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"未知智能歌单");
        var songs=queries.smart(user(session).getId(),rule,page);return Map.of("songs",songs.stream().limit(30).toList(),"hasMore",songs.size()>30);
    }
    @GetMapping("/api/library-tools/duplicates") @ResponseBody
    public Map<String,Object> duplicates(HttpSession session,@RequestParam(defaultValue="1") int page){var rows=merges.candidates(user(session).getId(),page);return Map.of("pairs",rows.stream().limit(30).toList(),"hasMore",rows.size()>30);}
    @GetMapping("/api/library-tools/merge-preview") @ResponseBody
    public Map<String,Object> mergePreview(HttpSession session,@RequestParam Long keep,@RequestParam Long remove){return merges.preview(user(session).getId(),keep,remove);}
    public record Merge(@NotNull @Positive Long keep,@NotNull @Positive Long remove,@NotBlank String fingerprint) {}
    @PostMapping("/api/library-tools/merge") @ResponseBody
    public Map<String,Boolean> merge(HttpSession session,@RequestHeader(value="X-Library-CSRF",required=false) String csrf,@Valid @RequestBody Merge input){merges.merge(mutation(session,csrf),input.keep(),input.remove(),input.fingerprint());return Map.of("saved",true);}
    @GetMapping("/api/library-tools/backup")
    public ResponseEntity<LibraryArchiveService.Archive> backup(HttpSession session){return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=sekai-song-library.json").cacheControl(CacheControl.noStore()).body(archives.export(user(session).getId()));}
    @PostMapping("/api/library-tools/backup-preview") @ResponseBody
    public Map<String,Object> backupPreview(HttpSession session,@RequestHeader(value="X-Library-CSRF",required=false) String csrf,@Valid @RequestBody LibraryArchiveService.Archive archive) {
        var preview=archives.preview(mutation(session,csrf),archive);String hash=hash(archive);session.setAttribute("libraryRestoreHash",hash);
        return Map.of("preview",preview,"confirmation",hash);
    }
    public record Restore(@NotNull @Valid LibraryArchiveService.Archive archive,@NotBlank String mode,@NotBlank String confirmation) {}
    @PostMapping("/api/library-tools/restore") @ResponseBody
    public LibraryArchiveService.Restored restore(HttpSession session,@RequestHeader(value="X-Library-CSRF",required=false) String csrf,@Valid @RequestBody Restore input) {
        Long id=mutation(session,csrf);
        if(!input.confirmation().equals(session.getAttribute("libraryRestoreHash")) || !input.confirmation().equals(hash(input.archive())))throw new ResponseStatusException(HttpStatus.CONFLICT,"请先预览当前备份");
        var result=archives.restore(id,input.archive(),input.mode());session.removeAttribute("libraryRestoreHash");return result;
    }
    public record Import(@NotBlank String source,@NotBlank @Size(max=120000) String input,Long playlistId) {}
    @PostMapping("/api/library-tools/import-tasks") @ResponseBody
    public Map<String,String> submit(HttpSession session,@RequestHeader(value="X-Library-CSRF",required=false) String csrf,@Valid @RequestBody Import input){return Map.of("id",tasks.submit(mutation(session,csrf),input.source(),input.input(),input.playlistId()));}
    @GetMapping("/api/library-tools/import-tasks") @ResponseBody
    public List<ImportTaskService.Task> tasks(HttpSession session){return tasks.list(user(session).getId());}
    @GetMapping("/api/library-tools/import-tasks/{id}") @ResponseBody
    public ImportTaskService.Task task(HttpSession session,@PathVariable String id){return tasks.get(user(session).getId(),id);}
    @PostMapping("/api/library-tools/import-tasks/{id}/retry") @ResponseBody
    public Map<String,String> retry(HttpSession session,@RequestHeader(value="X-Library-CSRF",required=false) String csrf,@PathVariable String id){return Map.of("id",tasks.retry(mutation(session,csrf),id));}
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,String>> error(ResponseStatusException error){return ResponseEntity.status(error.getStatusCode()).body(Map.of("message",Objects.toString(error.getReason(),"操作失败")));}
    private User user(HttpSession session){if(session.getAttribute("loginUser") instanceof User user && user.getId()!=null)return user;throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"请先登录");}
    private String token(HttpSession session){if(session.getAttribute("libraryToolsCsrf")==null)session.setAttribute("libraryToolsCsrf",UUID.randomUUID().toString());return (String)session.getAttribute("libraryToolsCsrf");}
    private Long mutation(HttpSession session,String csrf){User user=user(session);if(csrf==null || !csrf.equals(session.getAttribute("libraryToolsCsrf")))throw new ResponseStatusException(HttpStatus.FORBIDDEN,"页面已过期，请刷新后重试");return user.getId();}
    private String hash(Object input){try{return org.apache.commons.codec.digest.DigestUtils.sha256Hex(json.writeValueAsBytes(input));}catch(java.io.IOException e){throw new IllegalStateException(e);}}
}
