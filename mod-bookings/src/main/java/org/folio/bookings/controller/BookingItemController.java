package org.folio.bookings.controller;

import lombok.RequiredArgsConstructor;
import org.folio.bookings.domain.dto.BookingItem;
import org.folio.bookings.domain.dto.BookingItemCollection;
import org.folio.bookings.rest.resource.BookingItemsApi;
import org.folio.bookings.service.BookingItemService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/bookings-storage")
@RequiredArgsConstructor
public class BookingItemController implements BookingItemsApi {

  private final BookingItemService bookingItemService;

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
