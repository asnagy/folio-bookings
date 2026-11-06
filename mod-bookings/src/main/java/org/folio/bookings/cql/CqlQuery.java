package org.folio.bookings.cql;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.From;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.folio.bookings.entity.BookingItemEntity;
import org.folio.bookings.exception.BookingValidationException;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Small CQL subset translator (filter + sortby) for the booking search APIs.
 *
 * <p>Supported: {@code cql.allRecords=1}; {@code index op value} with ops
 * {@code == = <> < > <= >=}; value lists {@code index==("A" or "B")}; {@code and}/{@code or}
 * (left to right) with parentheses; {@code *} wildcards with {@code =};
 * {@code sortby index[/sort.descending] ...}. Unknown indexes are rejected with a validation error.
 */
public final class CqlQuery {

  /** Special index: true when any item needs or has triggered a recall. */
  public static final String RECALL_REQUIRED = "recallRequired";

  private static final Pattern SORTBY = Pattern.compile("(?i)\\s+sortby\\s+");

  private CqlQuery() {
  }

  // ------------------------------------------------------------------ public API

  public static <T> Specification<T> toSpecification(String cql, Map<String, CqlField> fields,
    String recallItemsPath) {
    var filter = splitFilter(cql);
    if (filter.isBlank() || isAllRecords(filter)) {
      return (root, query, cb) -> cb.conjunction();
    }
    var tokens = tokenize(filter);
    var parser = new Parser(tokens, fields, recallItemsPath);
    var node = parser.parseExpression();
    parser.expectEnd();
    return (root, query, cb) -> {
      query.distinct(true);
      return node.apply(new Ctx(root, cb));
    };
  }

  public static Sort toSort(String cql, Map<String, String> sortFields, Sort defaultSort) {
    if (cql == null) {
      return defaultSort;
    }
    var parts = SORTBY.split(cql, 2);
    if (parts.length < 2 || parts[1].isBlank()) {
      return defaultSort;
    }
    var orders = new ArrayList<Sort.Order>();
    for (String spec : parts[1].trim().split("\\s+")) {
      var pieces = spec.split("/");
      var attribute = sortFields.get(pieces[0]);
      if (attribute == null) {
        throw new BookingValidationException("Cannot sort by unknown index: " + pieces[0]);
      }
      boolean desc = pieces.length > 1 && pieces[1].toLowerCase(Locale.ROOT).contains("descending");
      orders.add(desc ? Sort.Order.desc(attribute) : Sort.Order.asc(attribute));
    }
    return Sort.by(orders);
  }

  // ------------------------------------------------------------------ helpers

  private static String splitFilter(String cql) {
    if (cql == null) {
      return "";
    }
    return SORTBY.split(cql, 2)[0].trim();
  }

  private static boolean isAllRecords(String filter) {
    return filter.replace(" ", "").equalsIgnoreCase("cql.allRecords=1");
  }

  private record Ctx(Root<?> root, CriteriaBuilder cb) {
    From<?, ?> join(String association) {
      for (var existing : root.getJoins()) {
        if (existing.getAttribute().getName().equals(association)) {
          return existing;
        }
      }
      return root.join(association, JoinType.LEFT);
    }

    Path<?> path(String path) {
      int dot = path.indexOf('.');
      if (dot < 0) {
        return root.get(path);
      }
      return join(path.substring(0, dot)).get(path.substring(dot + 1));
    }
  }

  @FunctionalInterface
  private interface Node {
    Predicate apply(Ctx ctx);
  }

  // ------------------------------------------------------------------ tokenizer

  private enum Kind { LPAREN, RPAREN, OP, WORD, QUOTED }

  private record Token(Kind kind, String text) {
  }

  private static List<Token> tokenize(String s) {
    var tokens = new ArrayList<Token>();
    int i = 0;
    while (i < s.length()) {
      char c = s.charAt(i);
      if (Character.isWhitespace(c)) {
        i++;
      } else if (c == '(') {
        tokens.add(new Token(Kind.LPAREN, "("));
        i++;
      } else if (c == ')') {
        tokens.add(new Token(Kind.RPAREN, ")"));
        i++;
      } else if (c == '"') {
        var sb = new StringBuilder();
        i++;
        while (i < s.length() && s.charAt(i) != '"') {
          if (s.charAt(i) == '\\' && i + 1 < s.length()) {
            i++;
          }
          sb.append(s.charAt(i++));
        }
        if (i >= s.length()) {
          throw new BookingValidationException("Unterminated quoted string in query");
        }
        i++;
        tokens.add(new Token(Kind.QUOTED, sb.toString()));
      } else if (c == '=' || c == '<' || c == '>') {
        int start = i++;
        if (i < s.length() && (s.charAt(i) == '=' || s.charAt(i) == '>')) {
          i++;
        }
        tokens.add(new Token(Kind.OP, s.substring(start, i)));
      } else {
        int start = i;
        while (i < s.length() && !Character.isWhitespace(s.charAt(i))
          && "()=<>\"".indexOf(s.charAt(i)) < 0) {
          i++;
        }
        tokens.add(new Token(Kind.WORD, s.substring(start, i)));
      }
    }
    return tokens;
  }

  // ------------------------------------------------------------------ parser

  private static final class Parser {
    private final List<Token> tokens;
    private final Map<String, CqlField> fields;
    private final String recallItemsPath;
    private int pos;

    Parser(List<Token> tokens, Map<String, CqlField> fields, String recallItemsPath) {
      this.tokens = tokens;
      this.fields = fields;
      this.recallItemsPath = recallItemsPath;
    }

    void expectEnd() {
      if (pos < tokens.size()) {
        throw new BookingValidationException("Unexpected '" + tokens.get(pos).text() + "' in query");
      }
    }

    Node parseExpression() {
      Node left = parseTerm();
      while (pos < tokens.size() && isBoolean(tokens.get(pos))) {
        boolean and = tokens.get(pos++).text().equalsIgnoreCase("and");
        Node l = left;
        Node r = parseTerm();
        left = and ? ctx -> ctx.cb().and(l.apply(ctx), r.apply(ctx))
                   : ctx -> ctx.cb().or(l.apply(ctx), r.apply(ctx));
      }
      return left;
    }

    private static boolean isBoolean(Token t) {
      return t.kind() == Kind.WORD
        && (t.text().equalsIgnoreCase("and") || t.text().equalsIgnoreCase("or"));
    }

    private Node parseTerm() {
      if (pos >= tokens.size()) {
        throw new BookingValidationException("Incomplete query");
      }
      if (tokens.get(pos).kind() == Kind.LPAREN) {
        pos++;
        Node inner = parseExpression();
        expect(Kind.RPAREN);
        return inner;
      }
      var indexToken = next(Kind.WORD);
      var opToken = next(Kind.OP);
      var values = parseValues();
      return buildComparison(indexToken.text(), opToken.text(), values);
    }

    private List<String> parseValues() {
      if (pos >= tokens.size()) {
        throw new BookingValidationException("Missing value in query");
      }
      var values = new ArrayList<String>();
      if (tokens.get(pos).kind() == Kind.LPAREN) {
        pos++;
        values.add(value());
        while (pos < tokens.size() && isBoolean(tokens.get(pos))) {
          pos++;
          values.add(value());
        }
        expect(Kind.RPAREN);
      } else {
        values.add(value());
      }
      return values;
    }

    private String value() {
      if (pos >= tokens.size()) {
        throw new BookingValidationException("Missing value in query");
      }
      var t = tokens.get(pos++);
      if (t.kind() != Kind.QUOTED && t.kind() != Kind.WORD) {
        throw new BookingValidationException("Unexpected '" + t.text() + "' where a value was expected");
      }
      return t.text();
    }

    private Token next(Kind kind) {
      if (pos >= tokens.size() || tokens.get(pos).kind() != kind) {
        throw new BookingValidationException("Malformed query near token " + (pos + 1));
      }
      return tokens.get(pos++);
    }

    private void expect(Kind kind) {
      next(kind);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private Node buildComparison(String index, String op, List<String> rawValues) {
      if (RECALL_REQUIRED.equals(index)) {
        boolean wanted = Boolean.parseBoolean(rawValues.get(0));
        return ctx -> {
          var status = ctx.path(recallItemsPath + ".recallStatus");
          var flagged = status.in(BookingItemEntity.RecallStatus.REQUIRED, BookingItemEntity.RecallStatus.TRIGGERED);
          return wanted ? flagged : ctx.cb().not(flagged);
        };
      }
      var field = fields.get(index);
      if (field == null) {
        throw new BookingValidationException("Unknown query index: " + index);
      }
      return ctx -> {
        Path<?> path = ctx.path(field.path());
        var cb = ctx.cb();
        var converted = new ArrayList<Object>();
        for (String raw : rawValues) {
          converted.add(convert(index, field.type(), raw, op));
        }
        switch (op) {
          case "==", "=" -> {
            if (field.type() == String.class && "=".equals(op)) {
              var preds = new ArrayList<Predicate>();
              for (Object v : converted) {
                preds.add(cb.like(cb.lower((Expression<String>) path), likePattern((String) v)));
              }
              return cb.or(preds.toArray(new Predicate[0]));
            }
            return converted.size() == 1 ? cb.equal(path, converted.get(0)) : path.in(converted);
          }
          case "<>" -> {
            return converted.size() == 1 ? cb.notEqual(path, converted.get(0)) : cb.not(path.in(converted));
          }
          case "<" -> {
            return cb.lessThan((Expression) path, (Comparable) converted.get(0));
          }
          case ">" -> {
            return cb.greaterThan((Expression) path, (Comparable) converted.get(0));
          }
          case "<=" -> {
            return cb.lessThanOrEqualTo((Expression) path, (Comparable) converted.get(0));
          }
          case ">=" -> {
            return cb.greaterThanOrEqualTo((Expression) path, (Comparable) converted.get(0));
          }
          default -> throw new BookingValidationException("Unsupported operator: " + op);
        }
      };
    }

    private static String likePattern(String value) {
      var escaped = value.toLowerCase(Locale.ROOT)
        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
      return escaped.replace('*', '%');
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static Object convert(String index, Class<?> type, String raw, String op) {
      try {
        if (type == String.class) {
          return raw;
        }
        if (type == UUID.class) {
          return UUID.fromString(raw);
        }
        if (type == OffsetDateTime.class) {
          return OffsetDateTime.parse(raw);
        }
        if (type.isEnum()) {
          return Enum.valueOf((Class<Enum>) type, raw.toUpperCase(Locale.ROOT));
        }
      } catch (IllegalArgumentException | java.time.format.DateTimeParseException e) {
        throw new BookingValidationException("Invalid value '" + raw + "' for index " + index);
      }
      throw new BookingValidationException("Unsupported type for index " + index);
    }
  }
}
