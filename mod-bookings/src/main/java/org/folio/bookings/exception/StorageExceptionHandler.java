package org.folio.bookings.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

/** Maps domain exceptions to FOLIO-style error responses. */
@RestControllerAdvice
public class StorageExceptionHandler {

  @ExceptionHandler(BookingValidationException.class)
  public ResponseEntity<Map<String, Object>> handleValidation(BookingValidationException e) {
    return error(HttpStatus.BAD_REQUEST, e.getMessage(), "VALIDATION_ERROR");
  }

  @ExceptionHandler(BookingNotFoundException.class)
  public ResponseEntity<Map<String, Object>> handleNotFound(BookingNotFoundException e) {
    return error(HttpStatus.NOT_FOUND, e.getMessage(), "NOT_FOUND");
  }

  private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message, String code) {
    var body = Map.<String, Object>of(
      "errors", List.of(Map.of("message", message, "code", code)),
      "total_records", 1);
    return ResponseEntity.status(status).body(body);
  }
}
