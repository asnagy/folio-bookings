package org.folio.bookings.service;

import org.folio.bookings.domain.dto.Event;
import org.folio.bookings.entity.EventEntity;
import org.folio.bookings.exception.BookingNotFoundException;
import org.folio.bookings.exception.BookingValidationException;
import org.folio.bookings.mapper.EventMapper;
import org.folio.bookings.repository.BookingRepository;
import org.folio.bookings.repository.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

  @Mock private EventRepository eventRepository;
  @Mock private BookingRepository bookingRepository;
  @Mock private EventMapper eventMapper;
  @InjectMocks private EventService service;

  private static Event event(String name, OffsetDateTime start, OffsetDateTime end) {
    var event = new Event();
    event.setName(name);
    event.setStartDate(start);
    event.setEndDate(end);
    return event;
  }

  @Test
  void createEvent_withBlankName_isRejected() {
    assertThrows(BookingValidationException.class, () -> service.createEvent(event("  ", null, null)));
    verify(eventRepository, never()).save(any());
  }

  @Test
  void createEvent_endBeforeStart_isRejected() {
    var now = OffsetDateTime.now();
    var ex = assertThrows(BookingValidationException.class,
      () -> service.createEvent(event("Orientation", now, now.minusDays(1))));
    assertTrue(ex.getMessage().contains("end date"));
  }

  @Test
  void createEvent_withoutDates_isAllowed() {
    var dto = event("Orientation", null, null);
    when(eventMapper.toEntity(dto)).thenReturn(new EventEntity());
    when(eventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    assertDoesNotThrow(() -> service.createEvent(dto));
    verify(eventRepository).save(any());
  }

  @Test
  void deleteEvent_usedByBookings_isRejected() {
    var id = UUID.randomUUID();
    when(eventRepository.existsById(id)).thenReturn(true);
    when(bookingRepository.countByEventId(id)).thenReturn(2L);

    var ex = assertThrows(BookingValidationException.class, () -> service.deleteEvent(id));
    assertTrue(ex.getMessage().contains("2 booking"));
    verify(eventRepository, never()).deleteById(any());
  }

  @Test
  void deleteEvent_unused_isDeleted() {
    var id = UUID.randomUUID();
    when(eventRepository.existsById(id)).thenReturn(true);
    when(bookingRepository.countByEventId(id)).thenReturn(0L);

    service.deleteEvent(id);

    verify(eventRepository).deleteById(id);
  }

  @Test
  void deleteEvent_unknown_isNotFound() {
    var id = UUID.randomUUID();
    when(eventRepository.existsById(id)).thenReturn(false);

    assertThrows(BookingNotFoundException.class, () -> service.deleteEvent(id));
  }

  @Test
  void getEvent_unknown_isNotFound() {
    var id = UUID.randomUUID();
    when(eventRepository.findById(id)).thenReturn(Optional.empty());

    assertThrows(BookingNotFoundException.class, () -> service.getEvent(id));
  }
}
