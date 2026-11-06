package org.folio.bookings.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookings.domain.dto.Booking;
import org.folio.bookings.domain.dto.BookingCollection;
import org.folio.bookings.cql.BookingQueries;
import org.folio.bookings.domain.dto.BookingItem;
import org.folio.bookings.entity.BookingEntity;
import org.folio.bookings.entity.BookingItemEntity;
import org.folio.bookings.exception.BookingNotFoundException;
import org.folio.bookings.exception.BookingValidationException;
import org.folio.bookings.mapper.BookingItemMapper;
import org.folio.bookings.mapper.BookingMapper;
import org.folio.bookings.repository.BookingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Log4j2
public class BookingService {

  private final BookingRepository bookingRepository;
  private final BookingMapper bookingMapper;
  private final BookingItemMapper bookingItemMapper;

  @Transactional(readOnly = true)
  public BookingCollection getBookings(String query, Integer offset, Integer limit) {
    log.debug("getBookings:: query={}, offset={}, limit={}", query, offset, limit);
    int pageSize = Math.max(limit, 1);
    var pageable = PageRequest.of(offset / pageSize, pageSize, BookingQueries.bookingSort(query));
    var page = bookingRepository.findAll(BookingQueries.bookingSpec(query), pageable);
    var collection = new BookingCollection();
    collection.setBookings(bookingMapper.toDtoList(page.getContent()));
    collection.setTotalRecords((int) page.getTotalElements());
    return collection;
  }

  @Transactional(readOnly = true)
  public Booking getBookingById(UUID id) {
    log.debug("getBookingById:: id={}", id);
    return bookingRepository.findById(id)
      .map(bookingMapper::toDto)
      .orElseThrow(() -> new BookingNotFoundException(id));
  }

  @Transactional
  public Booking createBooking(Booking booking) {
    log.info("createBooking:: userId={}, startDate={}", booking.getUserId(), booking.getStartDate());
    validateBookingDates(booking);
    var entity = bookingMapper.toEntity(booking);
    entity.setId(UUID.randomUUID());
    if (entity.getStatus() == null) {
      entity.setStatus(BookingEntity.BookingStatus.PENDING);
    }
    replaceItems(entity, booking.getItems());
    var saved = bookingRepository.save(entity);
    log.info("createBooking:: created bookingId={}", saved.getId());
    return bookingMapper.toDto(saved);
  }

  @Transactional
  public void updateBooking(UUID id, Booking booking) {
    log.info("updateBooking:: bookingId={}", id);
    var existing = bookingRepository.findById(id)
      .orElseThrow(() -> new BookingNotFoundException(id));
    validateBookingDates(booking);
    bookingMapper.updateEntityFromDto(booking, existing);
    if (booking.getItems() != null) {
      replaceItems(existing, booking.getItems());
    }
    bookingRepository.save(existing);
  }

  @Transactional
  public void deleteBooking(UUID id) {
    log.info("deleteBooking:: bookingId={}", id);
    if (!bookingRepository.existsById(id)) {
      throw new BookingNotFoundException(id);
    }
    bookingRepository.deleteById(id);
  }

  /** Replaces the booking's items with the given list, keeping each item pointed at its booking. */
  private void replaceItems(BookingEntity entity, List<BookingItem> items) {
    entity.getBookingItems().clear();
    if (items == null) {
      return;
    }
    for (BookingItem dto : items) {
      BookingItemEntity item = bookingItemMapper.toEntity(dto);
      item.setId(UUID.randomUUID());
      item.setBooking(entity);
      entity.getBookingItems().add(item);
    }
  }

  private void validateBookingDates(Booking booking) {
    if (booking.getStartDate() != null && booking.getEndDate() != null) {
      if (!booking.getStartDate().isBefore(booking.getEndDate())) {
        throw new BookingValidationException("startDate must be before endDate");
      }
    }
  }
}
