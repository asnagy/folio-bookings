package org.folio.bookings.controller;

import lombok.RequiredArgsConstructor;
import org.folio.bookings.domain.dto.Event;
import org.folio.bookings.domain.dto.EventCollection;
import org.folio.bookings.rest.resource.EventsApi;
import org.folio.bookings.service.EventService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/bookings-storage")
@RequiredArgsConstructor
public class EventController implements EventsApi {

  private final EventService eventService;

  @Override
  public ResponseEntity<EventCollection> getEvents(String query, Integer offset, Integer limit) {
    return ResponseEntity.ok(eventService.getEvents(query, offset, limit));
  }

  @Override
  public ResponseEntity<Event> createEvent(Event event) {
    return ResponseEntity.status(HttpStatus.CREATED).body(eventService.createEvent(event));
  }

  @Override
  public ResponseEntity<Event> getEventById(UUID eventId) {
    return ResponseEntity.ok(eventService.getEvent(eventId));
  }

  @Override
  public ResponseEntity<Void> updateEvent(UUID eventId, Event event) {
    eventService.updateEvent(eventId, event);
    return ResponseEntity.noContent().build();
  }

  @Override
  public ResponseEntity<Void> deleteEvent(UUID eventId) {
    eventService.deleteEvent(eventId);
    return ResponseEntity.noContent().build();
  }
}
