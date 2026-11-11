package org.folio.bookings.service;

import org.folio.bookings.domain.dto.Booking;
import org.folio.bookings.entity.BookingEntity;
import org.folio.bookings.exception.BookingValidationException;
import org.folio.bookings.mapper.BookingItemMapper;
import org.folio.bookings.mapper.BookingMapper;
import org.folio.bookings.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

  @Mock private BookingRepository bookingRepository;
  @Mock private BookingMapper bookingMapper;
  @Mock private BookingItemMapper bookingItemMapper;
  @InjectMocks private BookingService service;

  private static Booking booking() {
    var booking = new Booking();
    booking.setUserId(UUID.randomUUID());
    booking.setStartDate(OffsetDateTime.now().plusDays(1));
    booking.setEndDate(OffsetDateTime.now().plusDays(2));
    booking.setPickupServicePointId(UUID.randomUUID());
    return booking;
  }

  @Test
  void createBooking_deliveredWithoutLocation_isRejected() {
    var booking = booking();
    booking.setDelivered(true);

    assertThrows(BookingValidationException.class, () -> service.createBooking(booking));
    verify(bookingRepository, never()).save(any());
  }

  @Test
  void createBooking_notDeliveredWithoutServicePoint_isRejected() {
    var booking = booking();
    booking.setPickupServicePointId(null);

    assertThrows(BookingValidationException.class, () -> service.createBooking(booking));
  }

  @Test
  void createBooking_startNotBeforeEnd_isRejected() {
    var booking = booking();
    booking.setEndDate(booking.getStartDate());

    assertThrows(BookingValidationException.class, () -> service.createBooking(booking));
  }

  @Test
  void createBooking_deliveredWithLocation_isAccepted() {
    var booking = booking();
    booking.setDelivered(true);
    booking.setDeliveryLocation("Room 204");
    booking.setPickupServicePointId(null);
    when(bookingMapper.toEntity(booking)).thenReturn(new BookingEntity());
    when(bookingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

    assertDoesNotThrow(() -> service.createBooking(booking));
  }

  @Test
  void updateBooking_clearsOptionalFieldsThatAreNoLongerSet() {
    var id = UUID.randomUUID();
    var existing = new BookingEntity();
    existing.setDelivered(true);
    existing.setDeliveryLocation("Room 204");
    existing.setEventId(UUID.randomUUID());
    existing.setPickupByUserId(UUID.randomUUID());
    existing.setNotes("old");
    when(bookingRepository.findById(id)).thenReturn(Optional.of(existing));

    service.updateBooking(id, booking());

    assertFalse(existing.isDelivered());
    assertNull(existing.getDeliveryLocation());
    assertNull(existing.getEventId());
    assertNull(existing.getPickupByUserId());
    assertNull(existing.getNotes());
    verify(bookingRepository).save(existing);
  }
}
