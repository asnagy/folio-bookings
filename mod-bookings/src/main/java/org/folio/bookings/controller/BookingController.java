package org.folio.bookings.controller;

import lombok.RequiredArgsConstructor;
import org.folio.bookings.domain.dto.Booking;
import org.folio.bookings.domain.dto.BookingCollection;
import org.folio.bookings.domain.dto.BookingItem;
import org.folio.bookings.domain.dto.BookingItemCollection;
import org.folio.bookings.rest.resource.BookingsApi;
import org.folio.bookings.rest.resource.BookingItemsApi;
import org.folio.bookings.service.BookingItemService;
import org.folio.bookings.service.BookingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/bookings-storage")
@RequiredArgsConstructor
public class BookingController implements BookingsApi, BookingItemsApi {

  private final BookingService bookingService;
  private final BookingItemService bookingItemService;

  // --- Bookings ---

  @Override
  public ResponseEntity<BookingCollection> getBookings(String query, Integer offset, Integer limit) {
    return ResponseEntity.ok(bookingService.getBookings(query, offset, limit));
  }

  @Override
  public ResponseEntity<Booking> createBooking(Booking booking) {
    var created = bookingService.createBooking(booking);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @Override
  public ResponseEntity<Booking> getBookingById(UUID bookingId) {
    return ResponseEntity.ok(bookingService.getBookingById(bookingId));
  }

  @Override
  public ResponseEntity<Void> updateBooking(UUID bookingId, Booking booking) {
    bookingService.updateBooking(bookingId, booking);
    return ResponseEntity.noContent().build();
  }

  @Override
  public ResponseEntity<Void> deleteBooking(UUID bookingId) {
    bookingService.deleteBooking(bookingId);
    return ResponseEntity.noContent().build();
  }

  // --- Booking Items ---

  @Override
  public ResponseEntity<BookingItemCollection> getBookingItems(String query, Integer offset, Integer limit) {
    return ResponseEntity.ok(bookingItemService.getBookingItems(query, offset, limit));
  }

  @Override
  public ResponseEntity<BookingItem> createBookingItem(BookingItem bookingItem) {
    var created = bookingItemService.createBookingItem(bookingItem);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @Override
  public ResponseEntity<Void> deleteBookingItem(UUID bookingItemId) {
    bookingItemService.deleteBookingItem(bookingItemId);
    return ResponseEntity.noContent().build();
  }
}
