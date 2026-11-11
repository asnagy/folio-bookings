package org.folio.bookingsbl.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.folio.bookingsbl.client.SettingsClient;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Reads the Bookings settings from mod-settings (scope {@value BookingSettings#SCOPE}).
 * The Settings pages in ui-bookings write two entries: "limits" and "timing". Anything missing,
 * or any failure to read, falls back to the defaults so bookings keep working.
 *
 * <pre>
 * limits: { "defaultLimit": 5, "byPatronGroup": { "&lt;groupId&gt;": 2 }, "allowOverride": true }
 * timing: { "recallLeadDays": 3, "checkoutLeadMinutes": 0 }
 * </pre>
 */
@Service
@RequiredArgsConstructor
@Log4j2
public class SettingsService {

  private final SettingsClient settingsClient;

  public BookingSettings getSettings() {
    var defaults = BookingSettings.defaults();
    try {
      var result = settingsClient.getEntries("scope==" + BookingSettings.SCOPE, 100);
      if (result == null || result.getItems() == null) {
        return defaults;
      }
      JsonNode limits = null;
      JsonNode timing = null;
      for (var entry : result.getItems()) {
        if (BookingSettings.KEY_LIMITS.equals(entry.getKey())) {
          limits = entry.getValue();
        } else if (BookingSettings.KEY_TIMING.equals(entry.getKey())) {
          timing = entry.getValue();
        }
      }
      return parse(limits, timing, defaults);
    } catch (Exception e) {
      log.warn("getSettings:: could not read settings, using defaults: {}", e.getMessage());
      return defaults;
    }
  }

  static BookingSettings parse(JsonNode limits, JsonNode timing, BookingSettings defaults) {
    Integer defaultLimit = defaults.defaultBookingLimit();
    boolean allowOverride = defaults.allowLimitOverride();
    Map<String, Integer> byGroup = new HashMap<>(defaults.limitsByPatronGroup());
    if (limits != null && limits.isObject()) {
      defaultLimit = nonNegativeInt(limits.get("defaultLimit"), null);
      if (limits.hasNonNull("allowOverride")) {
        allowOverride = limits.get("allowOverride").asBoolean(true);
      }
      var groups = limits.get("byPatronGroup");
      if (groups != null && groups.isObject()) {
        groups.fields().forEachRemaining(f -> {
          var limit = nonNegativeInt(f.getValue(), null);
          if (limit != null) {
            byGroup.put(f.getKey(), limit);
          }
        });
      }
    }
    int recallDays = defaults.recallLeadDays();
    int checkoutMinutes = defaults.checkoutLeadMinutes();
    if (timing != null && timing.isObject()) {
      recallDays = nonNegativeInt(timing.get("recallLeadDays"), recallDays);
      checkoutMinutes = nonNegativeInt(timing.get("checkoutLeadMinutes"), checkoutMinutes);
    }
    return new BookingSettings(defaultLimit, Map.copyOf(byGroup), allowOverride, recallDays, checkoutMinutes);
  }

  /** Blank / missing / negative / non-numeric values mean "not set". */
  private static Integer nonNegativeInt(JsonNode node, Integer fallback) {
    if (node == null || node.isNull()) {
      return fallback;
    }
    if (node.isNumber() && node.asInt() >= 0) {
      return node.asInt();
    }
    if (node.isTextual() && node.asText().matches("\\d{1,9}")) {
      return Integer.parseInt(node.asText());
    }
    return fallback;
  }
}
