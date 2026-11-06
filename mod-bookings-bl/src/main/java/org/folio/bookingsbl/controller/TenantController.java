package org.folio.bookingsbl.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tenant API required by the FOLIO platform when a module is enabled for a tenant.
 * This module keeps no tenant data, so enabling and disabling are no-ops.
 */
@RestController
@RequestMapping("/_/tenant")
public class TenantController {

  @PostMapping
  public ResponseEntity<Void> enable() {
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping
  public ResponseEntity<Void> disable() {
    return ResponseEntity.noContent().build();
  }
}
