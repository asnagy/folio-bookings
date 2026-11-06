package org.folio.bookings.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Common audit columns. Dates are maintained here; user ids are set by the service layer
 * from the FOLIO execution context when available.
 */
@MappedSuperclass
@Getter
@Setter
public abstract class AuditableEntity {

  @Column(name = "created_date", nullable = false, updatable = false)
  private OffsetDateTime createdDate;

  @Column(name = "created_by_user_id", updatable = false)
  private UUID createdByUserId;

  @Column(name = "updated_date")
  private OffsetDateTime updatedDate;

  @Column(name = "updated_by_user_id")
  private UUID updatedByUserId;

  @PrePersist
  protected void onCreate() {
    var now = OffsetDateTime.now();
    createdDate = now;
    updatedDate = now;
  }

  @PreUpdate
  protected void onUpdate() {
    updatedDate = OffsetDateTime.now();
  }
}
