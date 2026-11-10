package org.folio.bookings.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;


import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "bookings",
  indexes = {
    @Index(name = "idx_bookings_user_id", columnList = "user_id"),
    @Index(name = "idx_bookings_status", columnList = "status"),
    @Index(name = "idx_bookings_start_date", columnList = "start_date")
  })
@Data
@EqualsAndHashCode(callSuper = false)
public class BookingEntity extends AuditableEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  @Column(updatable = false)
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "start_date", nullable = false)
  private OffsetDateTime startDate;

  @Column(name = "end_date", nullable = false)
  private OffsetDateTime endDate;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 32)
  private BookingStatus status = BookingStatus.PENDING;

  @Column(name = "notes", length = 2000)
  private String notes;

  @Column(name = "pickup_service_point_id")
  private UUID pickupServicePointId;

  @Column(name = "delivered", nullable = false)
  private boolean delivered;

  @Column(name = "delivery_location", length = 500)
  private String deliveryLocation;

  @Column(name = "pickup_by_user_id")
  private UUID pickupByUserId;

  @Column(name = "event_id")
  private UUID eventId;

  @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
  private List<BookingItemEntity> bookingItems = new ArrayList<>();

  public enum BookingStatus {
    PENDING,
    RECALL_REQUIRED,
    RECALL_TRIGGERED,
    CONFIRMED,
    ACTIVE,
    COMPLETED,
    CANCELLED
  }
}
