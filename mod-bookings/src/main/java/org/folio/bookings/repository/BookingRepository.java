package org.folio.bookings.repository;

import org.folio.bookings.entity.BookingEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<BookingEntity, UUID>,
  JpaSpecificationExecutor<BookingEntity> {

  long countByEventId(UUID eventId);

  Page<BookingEntity> findByUserId(UUID userId, Pageable pageable);

  Page<BookingEntity> findByStatus(BookingEntity.BookingStatus status, Pageable pageable);

  /**
   * Find bookings whose start date falls within a time window.
   * Used by the scheduler to trigger checkouts.
   */
  @Query("SELECT b FROM BookingEntity b WHERE b.startDate >= :from AND b.startDate <= :to " +
    "AND b.status IN ('CONFIRMED', 'RECALL_TRIGGERED', 'PENDING')")
  List<BookingEntity> findBookingsDueForCheckout(
    @Param("from") OffsetDateTime from,
    @Param("to") OffsetDateTime to);
}
