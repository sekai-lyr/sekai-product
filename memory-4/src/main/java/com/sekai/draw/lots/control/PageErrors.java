package com.sekai.draw.lots.control;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.ModelAndView;
import com.sekai.draw.lots.model.Result;

@ControllerAdvice
public class PageErrors {
    @ExceptionHandler({IllegalArgumentException.class, java.time.format.DateTimeParseException.class})
    public Object invalid(Exception exception, HttpServletRequest request) {
        String message = exception instanceof java.time.format.DateTimeParseException ? "日期格式不正确，请重新选择日期" : exception.getMessage();
        if (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json")) return ResponseEntity.badRequest().body(Result.fail(message));
        ModelAndView view = new ModelAndView("error"); view.setStatus(org.springframework.http.HttpStatus.BAD_REQUEST); view.addObject("friendlyError", message); return view;
    }
    @ExceptionHandler(IllegalStateException.class)
    public Object state(IllegalStateException exception, HttpServletRequest request) {
        if (request.getHeader("Accept") != null && request.getHeader("Accept").contains("application/json")) return ResponseEntity.status(503).body(Result.fail("暂时无法完成操作，请稍后重试"));
        ModelAndView view = new ModelAndView("error"); view.setStatus(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE); return view;
    }
}
