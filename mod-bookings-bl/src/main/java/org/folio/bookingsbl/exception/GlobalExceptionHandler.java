package org.folio.bookingsbl.exception;

import lombok.extern.log4j.Log4j2;
import org.folio.bookingsbl.domain.dto.Error;
import org.folio.bookingsbl.domain.dto.Errors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

@RestControllerAdvice
@Log4j2
public class GlobalExceptionHandler {

  @ExceptionHandler(BookingNotFoundException.class)
  public ResponseEntity<Errors> handleNotFound(BookingNotFoundException ex) {
    log.warn("handleNotFound:: {}", ex.getMessage());
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(buildErrors(ex.getMessage(), "NOT_FOUND"));
  }

  @ExceptionHandler(BookingBlException.class)
  public ResponseEntity<Errors> handleBookingBlException(BookingBlException ex) {
    log.warn("handleBookingBlException:: {}", ex.getMessage());
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(buildErrors(ex.getMessage(), "VALIDATION_ERROR"));
  }

  /** Errors from the storage module (e.g. deleting an event that is in use) keep their status and message. */
  @ExceptionHandler(feign.FeignException.class)
  public ResponseEntity<Errors> handleFeign(feign.FeignException ex) {
    log.warn("handleFeign:: status={} {}", ex.status(), ex.getMessage());
    int status = ex.status() >= 400 && ex.status() < 500 ? ex.status() : 500;
    String message = ex.status() >= 400 && ex.status() < 500 ? extractMessage(ex) : "Internal server error";
    return ResponseEntity.status(status).body(buildErrors(message, status == 404 ? "NOT_FOUND" : "STORAGE_ERROR"));
  }

  private static String extractMessage(feign.FeignException ex) {
    try {
      var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(ex.contentUTF8());
      var msg = node.path("errors").path(0).path("message").asText(null);
      return msg != null ? msg : "Request failed";
    } catch (Exception e) {
      return "Request failed";
    }
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Errors> handleGeneral(Exception ex) {
    log.error("handleGeneral:: unexpected error", ex);
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
      .body(buildErrors("Internal server error", "INTERNAL_ERROR"));
  }

  private Errors buildErrors(String message, String code) {
    var error = new Error();
    error.setMessage(message);
    error.setCode(code);
    var errors = new Errors();
    errors.setErrors(List.of(error));
    return errors;
  }
}
