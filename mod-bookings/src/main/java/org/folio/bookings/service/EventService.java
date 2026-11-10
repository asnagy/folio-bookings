package org.folio.bookings.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookings.cql.BookingQueries;
import org.folio.bookings.domain.dto.Event;
import org.folio.bookings.domain.dto.EventCollection;
import org.folio.bookings.exception.BookingNotFoundException;
import org.folio.bookings.exception.BookingValidationException;
import org.folio.bookings.mapper.EventMapper;
import org.folio.bookings.repository.BookingRepository;
import org.folio.bookings.repository.EventRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Log4j2
public class EventService {

  private final EventRepository eventRepository;
  private final BookingRepository bookingRepository;
  private final EventMapper eventMapper;

  @Transactional(readOnly = true)
  public EventCollection getEvents(String query, Integer offset, Integer limit) {
    int pageSize = Math.max(limit, 1);
    var pageable = PageRequest.of(offset / pageSize, pageSize, BookingQueries.eventSort(query));
    var page = eventRepository.findAll(BookingQueries.eventSpec(query), pageable);
    var collection = new EventCollection();
    collection.setEvents(eventMapper.toDtoList(page.getContent()));
    collection.setTotalRecords((int) page.getTotalElements());
    return collection;
  }

  @Transactional(readOnly = true)
  public Event getEvent(UUID id) {
    return eventRepository.findById(id).map(eventMapper::toDto)
      .orElseThrow(() -> new BookingNotFoundException(id));
  }

  @Transactional
  public Event createEvent(Event event) {
    validate(event);
    var entity = eventMapper.toEntity(event);
    entity.setId(UUID.randomUUID());
    return eventMapper.toDto(eventRepository.save(entity));
  }

  @Transactional
  public void updateEvent(UUID id, Event event) {
    validate(event);
    var existing = eventRepository.findById(id).orElseThrow(() -> new BookingNotFoundException(id));
    eventMapper.updateEntity(event, existing);
    eventRepository.save(existing);
  }

  @Transactional
  public void deleteEvent(UUID id) {
    if (!eventRepository.existsById(id)) {
      throw new BookingNotFoundException(id);
    }
    long used = bookingRepository.countByEventId(id);
    if (used > 0) {
      throw new BookingValidationException("Event is used by " + used + " booking(s) and cannot be deleted");
    }
    eventRepository.deleteById(id);
  }

  private void validate(Event event) {
    if (event.getName() == null || event.getName().isBlank()) {
      throw new BookingValidationException("name is required");
    }
    if (event.getStartDate() != null && event.getEndDate() != null
      && event.getEndDate().isBefore(event.getStartDate())) {
      throw new BookingValidationException("Event end date must not be before its start date");
    }
  }
}
