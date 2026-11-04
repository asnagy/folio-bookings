package org.folio.bookingsbl.controller;

import lombok.RequiredArgsConstructor;
import org.folio.bookingsbl.domain.dto.*;
import org.folio.bookingsbl.rest.resource.BookingsApi;
import org.folio.bookingsbl.service.BookingBlService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/bookings")
@RequiredArgsConstructor
public class BookingBlController implements BookingsApi {

  private final BookingBlService bookingBlService;

  @Override
  public ResponseEntity<BookingCollection> getBookings(String query, Integer offset, Integer limit) {
    return ResponseEntity.ok(bookingBlService.getBookings(query,
      offset != null ? offset : 0,
      limit  != null ? limit  : 10));
  }

  @Override
  public ResponseEntity<BookingResponse> createBooking(BookingRequest request) {
    var created = bookingBlService.createBooking(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @Override
  public ResponseEntity<BookingResponse> getBookingById(UUID bookingId) {
    return ResponseEntity.ok(bookingBlService.getBookingById(bookingId));
  }

  @Override
  public ResponseEntity<BookingResponse> updateBooking(UUID bookingId, BookingRequest request) {
    return ResponseEntity.ok(bookingBlService.updateBooking(bookingId, request));
  }

  @Override
  public ResponseEntity<Void> deleteBooking(UUID bookingId) {
    bookingBlService.deleteBooking(bookingId);
    return ResponseEntity.noContent().build();
  }

  @Override
  public ResponseEntity<BookingResponse> activateBooking(UUID bookingId) {
    return ResponseEntity.ok(bookingBlService.activateBooking(bookingId));
  }
}
