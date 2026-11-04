package org.folio.bookings.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.folio.spring.domain.model.AuditableEntity;

import java.util.UUID;

@Entity
@Table(name = "booking_items",
  indexes = {
    @Index(name = "idx_booking_items_booking_id", columnList = "booking_id"),
    @Index(name = "idx_booking_items_item_id", columnList = "item_id")
  })
@Data
@EqualsAndHashCode(callSuper = false)
public class BookingItemEntity extends AuditableEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  @Column(updatable = false)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "booking_id", nullable = false)
  private BookingEntity booking;

  @Column(name = "item_id", nullable = false)
  private UUID itemId;

  @Column(name = "instance_id")
  private UUID instanceId;

  @Column(name = "holdings_record_id")
  private UUID holdingsRecordId;

  @Column(name = "item_barcode", length = 128)
  private String itemBarcode;

  @Column(name = "item_title", length = 512)
  private String itemTitle;

  @Column(name = "call_number", length = 256)
  private String callNumber;

  @Enumerated(EnumType.STRING)
  @Column(name = "recall_status", nullable = false, length = 32)
  private RecallStatus recallStatus = RecallStatus.NOT_REQUIRED;

  public enum RecallStatus {
    NOT_REQUIRED,
    REQUIRED,
    TRIGGERED,
    RETURNED
  }
}
