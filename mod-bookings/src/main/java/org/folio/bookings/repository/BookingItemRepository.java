package org.folio.bookings.repository;

import org.folio.bookings.entity.BookingItemEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingItemRepository extends JpaRepository<BookingItemEntity, UUID>,
  JpaSpecificationExecutor<BookingItemEntity> {

  List<BookingItemEntity> findByBookingId(UUID bookingId);

  Page<BookingItemEntity> findByBookingId(UUID bookingId, Pageable pageable);

  boolean existsByBookingIdAndItemId(UUID bookingId, UUID itemId);

  List<BookingItemEntity> findByItemId(UUID itemId);
}
