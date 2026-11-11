package org.folio.bookingsbl.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.folio.bookingsbl.client.SettingsClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SettingsServiceTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Mock
  private SettingsClient settingsClient;
  @InjectMocks
  private SettingsService settingsService;

  private static JsonNode json(String text) throws Exception {
    return MAPPER.readTree(text);
  }

  private static SettingsClient.Entry entry(String key, JsonNode value) {
    var entry = new SettingsClient.Entry();
    entry.setId(UUID.randomUUID());
    entry.setScope(BookingSettings.SCOPE);
    entry.setKey(key);
    entry.setValue(value);
    return entry;
  }

  @Test
  void getSettings_withNoEntries_returnsDefaults() {
    var result = new SettingsClient.SettingsCollection();
    result.setItems(List.of());
    when(settingsClient.getEntries(anyString(), anyInt())).thenReturn(result);

    var settings = settingsService.getSettings();

    assertNull(settings.defaultBookingLimit());
    assertTrue(settings.allowLimitOverride());
    assertEquals(3, settings.recallLeadDays());
    assertEquals(0, settings.checkoutLeadMinutes());
  }

  @Test
  void getSettings_whenSettingsModuleFails_returnsDefaults() {
    when(settingsClient.getEntries(anyString(), anyInt())).thenThrow(new RuntimeException("down"));

    assertEquals(BookingSettings.defaults(), settingsService.getSettings());
  }

  @Test
  void getSettings_readsLimitsAndTiming() throws Exception {
    var result = new SettingsClient.SettingsCollection();
    result.setItems(List.of(
      entry("limits", json("{\"defaultLimit\":5,\"byPatronGroup\":{\"g1\":2,\"g2\":0},\"allowOverride\":false}")),
      entry("timing", json("{\"recallLeadDays\":7,\"checkoutLeadMinutes\":15}"))));
    when(settingsClient.getEntries(anyString(), anyInt())).thenReturn(result);

    var settings = settingsService.getSettings();

    assertEquals(5, settings.defaultBookingLimit());
    assertFalse(settings.allowLimitOverride());
    assertEquals(7, settings.recallLeadDays());
    assertEquals(15, settings.checkoutLeadMinutes());
    assertEquals(2, settings.limitFor("g1"));
    assertEquals(0, settings.limitFor("g2"));
    assertEquals(5, settings.limitFor("unknown"));
    assertEquals(5, settings.limitFor(null));
  }

  @Test
  void parse_ignoresInvalidValues() throws Exception {
    var settings = SettingsService.parse(
      json("{\"defaultLimit\":-1,\"byPatronGroup\":{\"g1\":\"x\",\"g2\":\"4\"}}"),
      json("{\"recallLeadDays\":\"abc\",\"checkoutLeadMinutes\":-5}"),
      BookingSettings.defaults());

    assertNull(settings.defaultBookingLimit());
    assertNull(settings.limitFor("g1"));
    assertEquals(4, settings.limitFor("g2"));
    assertEquals(3, settings.recallLeadDays());
    assertEquals(0, settings.checkoutLeadMinutes());
  }

  @Test
  void limitFor_withoutDefaultOrGroupLimit_isUnlimited() {
    assertNull(BookingSettings.defaults().limitFor("any"));
  }
}
