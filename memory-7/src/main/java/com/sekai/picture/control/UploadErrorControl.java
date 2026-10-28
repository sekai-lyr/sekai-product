package com.sekai.picture.control;

import com.sekai.picture.model.Result;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.ModelAndView;

@ControllerAdvice
public class UploadErrorControl {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Object tooLarge(HttpServletRequest request) {
        if (request.getRequestURI().startsWith("/api/")) return ResponseEntity.status(413).body(Result.fail("每张图片不能超过 20 MB"));
        return new ModelAndView("redirect:/upload?tooLarge=true");
    }
}
