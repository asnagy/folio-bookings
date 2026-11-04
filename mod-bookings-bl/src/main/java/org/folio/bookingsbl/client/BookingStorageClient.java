package org.folio.bookingsbl.client;

import org.folio.bookingsbl.domain.dto.BookingRequest;
import org.folio.bookingsbl.domain.dto.BookingResponse;
import org.folio.bookingsbl.domain.dto.BookingCollection;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Feign client for communicating with mod-bookings (storage layer) via Okapi.
 * All requests are routed through the Okapi gateway which injects tenant/auth headers.
 */
@FeignClient(name = "mod-bookings", url = "${okapi.url}", configuration = OkapiClientConfig.class)
public interface BookingStorageClient {

  @GetMapping("/bookings-storage/bookings")
  BookingCollection getBookings(
    @RequestParam(required = false) String query,
    @RequestParam(defaultValue = "0") int offset,
    @RequestParam(defaultValue = "10") int limit);

  @GetMapping("/bookings-storage/bookings/{id}")
  BookingResponse getBookingById(@PathVariable UUID id);

  @PostMapping("/bookings-storage/bookings")
  BookingResponse createBooking(@RequestBody BookingRequest booking);

  @PutMapping("/bookings-storage/bookings/{id}")
  void updateBooking(@PathVariable UUID id, @RequestBody BookingRequest booking);

  @DeleteMapping("/bookings-storage/bookings/{id}")
  void deleteBooking(@PathVariable UUID id);
}
