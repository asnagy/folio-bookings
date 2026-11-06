package org.folio.bookingsbl.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class StorageBookingCollection {
  private List<StorageBooking> bookings = new ArrayList<>();
  private int totalRecords;
}
