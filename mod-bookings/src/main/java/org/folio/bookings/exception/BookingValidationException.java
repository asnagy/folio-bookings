package org.folio.bookings.exception;

public class BookingValidationException extends RuntimeException {
  public BookingValidationException(String message) {
    super(message);
  }
}
