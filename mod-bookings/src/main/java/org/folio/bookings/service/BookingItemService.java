package org.folio.bookings.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookings.domain.dto.BookingItem;
import org.folio.bookings.domain.dto.BookingItemCollection;
import org.folio.bookings.cql.BookingQueries;
import org.folio.bookings.entity.BookingEntity;
import org.folio.bookings.entity.BookingItemEntity;
import org.folio.bookings.exception.BookingNotFoundException;
import org.folio.bookings.exception.BookingValidationException;
import org.folio.bookings.mapper.BookingItemMapper;
import org.folio.bookings.repository.BookingItemRepository;
import org.folio.bookings.repository.BookingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Log4j2
public class BookingItemService {

  private final BookingItemRepository bookingItemRepository;
  private final BookingRepository bookingRepository;
  private final BookingItemMapper bookingItemMapper;

  @Transactional(readOnly = true)
  public BookingItemCollection getBookingItems(String query, Integer offset, Integer limit) {
    log.debug("getBookingItems:: offset={} limit={}", offset, limit);
    int pageSize = Math.max(limit, 1);
    var pageable = PageRequest.of(offset / pageSize, pageSize, BookingQueries.itemSort(query));
    var page = bookingItemRepository.findAll(BookingQueries.itemSpec(query), pageable);
    var collection = new BookingItemCollection();
    collection.setBookingItems(bookingItemMapper.toDtoList(page.getContent()));
    collection.setTotalRecords((int) page.getTotalElements());
    return collection;
  }

  @Transactional
  public BookingItem createBookingItem(BookingItem bookingItem) {
    log.info("createBookingItem:: bookingId={} itemId={}",
      bookingItem.getBookingId(), bookingItem.getItemId());

    var bookingId = bookingItem.getBookingId();
    if (bookingId == null) {
      throw new BookingValidationException("bookingId is required");
    }
    BookingEntity booking = bookingRepository.findById(bookingId)
      .orElseThrow(() -> new BookingNotFoundException(bookingId));

    if (bookingItemRepository.existsByBookingIdAndItemId(bookingId, bookingItem.getItemId())) {
      throw new BookingValidationException(
        "Item " + bookingItem.getItemId() + " is already associated with booking " + bookingId);
    }

    var entity = bookingItemMapper.toEntity(bookingItem);
    entity.setId(UUID.randomUUID());
    entity.setBooking(booking);

    var saved = bookingItemRepository.save(entity);
    return bookingItemMapper.toDto(saved);
  }

  @Transactional
  public void deleteBookingItem(UUID bookingItemId) {
    log.info("deleteBookingItem:: bookingItemId={}", bookingItemId);
    if (!bookingItemRepository.existsById(bookingItemId)) {
      throw new BookingNotFoundException(bookingItemId);
    }
    bookingItemRepository.deleteById(bookingItemId);
  }
}
