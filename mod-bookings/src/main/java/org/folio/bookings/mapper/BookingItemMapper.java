package org.folio.bookings.mapper;

import org.folio.bookings.domain.dto.BookingItem;
import org.folio.bookings.entity.BookingItemEntity;
import org.mapstruct.*;

import java.util.List;
import java.util.UUID;

@Mapper(componentModel = "spring",
  nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface BookingItemMapper {

  @Mapping(target = "booking", ignore = true)
  BookingItemEntity toEntity(BookingItem dto);

  @Mapping(source = "booking.id", target = "bookingId")
  BookingItem toDto(BookingItemEntity entity);

  List<BookingItem> toDtoList(List<BookingItemEntity> entities);

  default UUID map(String value) {
    return value != null ? UUID.fromString(value) : null;
  }
}
