package org.folio.bookingsbl.controller;

import lombok.RequiredArgsConstructor;
import org.folio.bookingsbl.client.BookingStorageClient;
import org.folio.bookingsbl.client.StorageEvent;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Events that bookings can be made for; managed from Settings > Bookings > Events. */
@RestController
@RequestMapping("/bookings/events")
@RequiredArgsConstructor
public class EventController {

  private final BookingStorageClient storage;

  @GetMapping
  public StorageEvent.Collection list(@RequestParam(required = false) String query,
                                      @RequestParam(defaultValue = "0") int offset,
                                      @RequestParam(defaultValue = "100") int limit) {
    return storage.getEvents(query, offset, limit);
  }

  @GetMapping("/{id}")
  public StorageEvent get(@PathVariable UUID id) {
    return storage.getEvent(id);
  }

  @PostMapping
  public ResponseEntity<StorageEvent> create(@RequestBody StorageEvent event) {
    return ResponseEntity.status(HttpStatus.CREATED).body(storage.createEvent(event));
  }

  @PutMapping("/{id}")
  public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody StorageEvent event) {
    storage.updateEvent(id, event);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable UUID id) {
    storage.deleteEvent(id);
    return ResponseEntity.noContent().build();
  }
}
