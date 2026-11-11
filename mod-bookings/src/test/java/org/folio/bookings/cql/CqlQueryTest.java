package org.folio.bookings.cql;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CqlQueryTest {

  private static final Map<String, CqlField> FIELDS = Map.of(
    "id", CqlField.of("id", UUID.class),
    "userId", CqlField.of("userId", UUID.class),
    "notes", CqlField.of("notes", String.class),
    "delivered", CqlField.of("delivered", Boolean.class),
    "endDate", CqlField.of("endDate", OffsetDateTime.class));

  @Test
  void toSpecification_acceptsTheQueriesTheBlModuleSends() {
    var userId = UUID.randomUUID();
    var queries = new String[] {
      "cql.allRecords=1",
      "userId==\"" + userId + "\" and endDate>=\"2026-11-11T10:00:00-05:00\"",
      "delivered==true",
      "notes=\"*lab*\" or userId==(\"" + userId + "\" or \"" + UUID.randomUUID() + "\")",
      "cql.allRecords=1 sortby endDate/sort.descending",
    };
    for (String query : queries) {
      assertNotNull(CqlQuery.toSpecification(query, FIELDS, "bookingItems"), query);
    }
  }

  @Test
  void toSpecification_rejectsUnknownIndexes() {
    assertThrows(RuntimeException.class,
      () -> CqlQuery.toSpecification("nonsense==1", FIELDS, "bookingItems"));
  }

  @Test
  void toSort_readsDirection() {
    var sort = CqlQuery.toSort("cql.allRecords=1 sortby endDate/sort.descending",
      Map.of("endDate", "endDate"), Sort.by("id"));

    assertEquals(Sort.Direction.DESC, sort.getOrderFor("endDate").getDirection());
  }

  @Test
  void toSort_withoutSortClause_usesTheDefault() {
    var sort = CqlQuery.toSort("cql.allRecords=1", Map.of("endDate", "endDate"), Sort.by("id"));

    assertEquals(Sort.by("id"), sort);
  }
}
