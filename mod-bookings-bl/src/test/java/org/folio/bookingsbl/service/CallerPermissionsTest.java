package org.folio.bookingsbl.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CallerPermissionsTest {

  @AfterEach
  void clear() {
    RequestContextHolder.resetRequestAttributes();
  }

  private static void request(String permissionsHeader) {
    var request = new MockHttpServletRequest();
    if (permissionsHeader != null) {
      request.addHeader("X-Okapi-Permissions", permissionsHeader);
    }
    RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
  }

  @Test
  void has_whenHeaderListsPermission_isTrue() {
    request("[\"bookings.override-limit\",\"users.item.get\"]");
    assertTrue(new CallerPermissions(true).has(CallerPermissions.OVERRIDE_LIMIT));
  }

  @Test
  void has_whenHeaderLacksPermission_isFalse() {
    request("[\"bookings.override-availability\"]");
    assertFalse(new CallerPermissions(false).has(CallerPermissions.OVERRIDE_LIMIT));
  }

  @Test
  void has_withoutHeader_dependsOnConfiguration() {
    request(null);
    assertTrue(new CallerPermissions(false).has(CallerPermissions.OVERRIDE_LIMIT));
    assertFalse(new CallerPermissions(true).has(CallerPermissions.OVERRIDE_LIMIT));
  }

  @Test
  void parse_acceptsJsonArrayAndCommaSeparatedForms() {
    assertEquals(2, CallerPermissions.parse("[\"a.b\", \"c.d\"]").size());
    assertEquals(2, CallerPermissions.parse("a.b,c.d").size());
    assertTrue(CallerPermissions.parse("[]").isEmpty());
  }
}
