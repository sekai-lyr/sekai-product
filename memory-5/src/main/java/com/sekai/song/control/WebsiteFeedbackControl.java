package com.sekai.song.control;

import com.sekai.song.config.WebsiteAdminAccess;
import com.sekai.song.model.User;
import com.sekai.song.service.WebsiteFeedbackService;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import java.util.UUID;

@Controller
public class WebsiteFeedbackControl {
    @Resource private WebsiteFeedbackService service;
    @Resource private WebsiteAdminAccess admin;
    private User user(HttpSession session){if(session.getAttribute("loginUser") instanceof User user && user.getId()!=null)return user;throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);}
    private User administrator(HttpSession session){User user=user(session);if(!admin.allowed(user))throw new ResponseStatusException(HttpStatus.FORBIDDEN);return user;}
    private String csrf(HttpSession session){if(session.getAttribute("feedbackCsrf")==null)session.setAttribute("feedbackCsrf",UUID.randomUUID().toString());return (String)session.getAttribute("feedbackCsrf");}
    private User mutation(HttpSession session,String token){User user=user(session);if(token==null || !token.equals(session.getAttribute("feedbackCsrf")))throw new ResponseStatusException(HttpStatus.FORBIDDEN);return user;}
    private int page(int page){if(page<0 || page>10000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);return page;}

    @GetMapping("/feedback")
    public String feedback(HttpSession session,Model model){
        User user=session.getAttribute("loginUser") instanceof User current?current:new User();if(user.getNickName()==null)user.setNickName("访客");
        model.addAttribute("loginUser",user);return "website-feedback";
    }
    @GetMapping("/admin/overview")
    public String overview(HttpSession session,Model model){
        if(!(session.getAttribute("loginUser") instanceof User))return "redirect:/login";
        model.addAttribute("loginUser",administrator(session));return "website-overview";
    }
    @GetMapping("/api/feedback") @ResponseBody
    public Map<String,Object> list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="latest") String sort,HttpSession session){
        if(!java.util.List.of("latest","hot").contains(sort))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        boolean logged=session.getAttribute("loginUser") instanceof User current && current.getId()!=null;
        return Map.of("reviews",service.publicReviews(logged?user(session).getId():null,page(page),sort),"own",logged?service.reviews(null,user(session).getId(),0):java.util.List.of(),"loggedIn",logged,"csrf",logged?csrf(session):"","community",service.community(),"nickname",logged?java.util.Objects.toString(user(session).getNickName(),"听友"):"访客");
    }
    @GetMapping("/api/feedback/{id}/replies") @ResponseBody
    public Map<String,Object> replies(@PathVariable long id,@RequestParam(defaultValue="0") int page,HttpSession session){
        Long viewer=session.getAttribute("loginUser") instanceof User current?current.getId():null;
        return Map.of("replies",service.replies(id,viewer,page(page)));
    }
    @PostMapping("/api/feedback/{id}/like") @ResponseBody
    public Map<String,Object> like(@PathVariable long id,@RequestBody @Valid WebsiteFeedbackService.Like input,HttpSession session,@RequestHeader(value="X-Feedback-CSRF",required=false) String token){
        return service.like(id,mutation(session,token).getId(),input.liked());
    }
    @PostMapping("/api/feedback") @ResponseBody
    public Map<String,Long> submit(@RequestBody @Valid WebsiteFeedbackService.Review input,HttpSession session,@RequestHeader(value="X-Feedback-CSRF",required=false) String token){return Map.of("id",service.submit(mutation(session,token).getId(),input));}
    @GetMapping("/api/admin/overview") @ResponseBody
    public Map<String,Object> data(HttpSession session){administrator(session);return Map.of("data",service.overview(),"csrf",csrf(session));}
    @GetMapping("/api/admin/feedback") @ResponseBody
    public Map<String,Object> queue(@RequestParam(defaultValue="pending") String status,@RequestParam(defaultValue="0") int page,HttpSession session){
        administrator(session);if(!java.util.List.of("pending","approved","rejected").contains(status))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return Map.of("reviews",service.reviews(status,null,page(page)));
    }
    @PostMapping("/api/admin/feedback/{id}") @ResponseBody
    public Map<String,Boolean> moderate(@PathVariable long id,@RequestBody @Valid WebsiteFeedbackService.Moderation input,HttpSession session,@RequestHeader(value="X-Feedback-CSRF",required=false) String token){
        administrator(session);mutation(session,token);service.moderate(id,input.status());return Map.of("saved",true);
    }
    @GetMapping("/api/admin/feedback/export") @ResponseBody
    public ResponseEntity<String> export(HttpSession session){administrator(session);return ResponseEntity.ok().header("Content-Disposition","attachment; filename=sekai-website-feedback.csv").header("Cache-Control","no-store").contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).body(service.export());}
    @GetMapping("/api/listening/token") @ResponseBody
    public Map<String,String> token(HttpSession session){user(session);return Map.of("csrf",csrf(session));}
    @PostMapping("/api/listening/start") @ResponseBody
    public Map<String,String> start(@RequestBody @Valid WebsiteFeedbackService.Start input,HttpSession session,@RequestHeader(value="X-Feedback-CSRF",required=false) String token){return Map.of("id",service.start(mutation(session,token).getId(),input));}
    @PostMapping("/api/listening/{id}") @ResponseBody
    public Map<String,Long> heartbeat(@PathVariable String id,@RequestBody @Valid WebsiteFeedbackService.Heartbeat input,HttpSession session,@RequestHeader(value="X-Feedback-CSRF",required=false) String token){
        if(!id.matches("[0-9a-fA-F-]{36}"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return Map.of("acceptedMs",service.heartbeat(mutation(session,token).getId(),id,input));
    }
}
