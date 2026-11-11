package org.folio.bookingsbl.exception;

/** The caller asked for an override they do not have the permission for. */
public class BookingForbiddenException extends RuntimeException {
  public BookingForbiddenException(String message) {
    super(message);
  }
}
