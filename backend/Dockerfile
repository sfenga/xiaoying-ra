# ---- 构建阶段 ----
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

# ---- 运行阶段 ----
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/xiaoying-ra-backend.jar app.jar
ENV UPLOAD_DIR=/data/uploads
VOLUME ["/data/uploads"]
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
