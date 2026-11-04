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
