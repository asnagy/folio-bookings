package org.folio.bookings.mapper;

import org.folio.bookings.domain.dto.Event;
import org.folio.bookings.entity.EventEntity;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring")
public interface EventMapper {

  EventEntity toEntity(Event dto);

  @Mapping(source = "createdDate", target = "metadata.createdDate")
  @Mapping(source = "createdByUserId", target = "metadata.createdByUserId")
  @Mapping(source = "updatedDate", target = "metadata.updatedDate")
  @Mapping(source = "updatedByUserId", target = "metadata.updatedByUserId")
  Event toDto(EventEntity entity);

  List<Event> toDtoList(List<EventEntity> entities);

  @Mapping(target = "id", ignore = true)
  void updateEntity(Event dto, @MappingTarget EventEntity entity);
}
