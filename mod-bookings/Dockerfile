FROM folioci/alpine-jre-openjdk17:latest

ENV APP_FILE mod-bookings.jar

ENV HOME=/home/folio
WORKDIR ${HOME}

COPY target/*.jar ${APP_FILE}

USER folio

EXPOSE 8081

ENTRYPOINT java ${JAVA_OPTIONS} -jar ${APP_FILE}
