# Build the Angular production application.
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --global npm@11.21.0
RUN npm ci

COPY frontend/ ./
RUN npm run build -- --configuration production

# Restore and publish the ASP.NET Core API.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src

COPY global.json ./
COPY backend/MyLibrary.Api/MyLibrary.Api.csproj backend/MyLibrary.Api/
RUN dotnet restore backend/MyLibrary.Api/MyLibrary.Api.csproj

COPY backend/MyLibrary.Api/ backend/MyLibrary.Api/
RUN dotnet publish backend/MyLibrary.Api/MyLibrary.Api.csproj \
    --configuration Release \
    --output /out \
    --no-restore

# Serve the API and Angular from the same Render web service.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=backend-build /out/ ./
COPY --from=frontend-build /src/frontend/dist/my-library/browser/ ./wwwroot/

ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://0.0.0.0:10000

EXPOSE 10000
ENTRYPOINT ["dotnet", "MyLibrary.Api.dll"]
