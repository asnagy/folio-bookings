# Build with Maven, then run on a slim JRE. Works on Apple Silicon (arm64) and Intel (amd64).
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
COPY descriptors ./descriptors
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:17-jre
RUN useradd --create-home folio
WORKDIR /home/folio
COPY --from=build /build/target/mod-bookings-bl-*.jar app.jar
USER folio
EXPOSE 8082
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTIONS -jar app.jar"]
