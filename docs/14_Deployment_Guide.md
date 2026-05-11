# Deployment & Production Operations Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Docker Compose Setup](#docker-compose-setup)
4. [Environment Configuration](#environment-configuration)
5. [SSL & Reverse Proxy Settings](#ssl--reverse-proxy-settings)
6. [First-Run Operations](#first-run-operations)

---

## Overview
This guide provides instructions to deploy the React frontend, Express backend, and SQL Server database onto a production Linux/Ubuntu server using Docker Compose and Nginx.

---

## Prerequisites
* Linux OS (Ubuntu 22.04 LTS recommended)
* Docker v24+ & Docker Compose v2+
* Domain registered with DNS mapping pointing to server IP

---

## Docker Compose Setup

Create a `docker-compose.yml` file in the project's root directory:

```yaml
version: '3.8'

services:
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: sql_server_container
    environment:
      - ACCEPT_EULA=Y
      - MSSQL_SA_PASSWORD=SecureMssqlPassword123!
    ports:
      - "1433:1433"
    volumes:
      - sql_data:/var/opt/mssql
    restart: always

  backend:
    build: ./backend
    container_name: express_backend_container
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - DB_USER=sa
      - DB_PASSWORD=SecureMssqlPassword123!
      - DB_SERVER=db
      - DB_NAME=RetailOpsDb
      - JWT_SECRET=ProductionSuperSecretJwtKey99!
    depends_on:
      - db
    restart: always

  frontend:
    build: .
    container_name: vite_frontend_container
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: always

volumes:
  sql_data:
```

---

## Environment Configuration
Create a secure `.env` configuration file in your `/backend` directory before starting:
```ini
PORT=5000
DB_USER=sa
DB_PASSWORD=SecureMssqlPassword123!
DB_SERVER=db
DB_NAME=RetailOpsDb
JWT_SECRET=ProductionSuperSecretJwtKey99!
STRIPE_API_KEY=sk_live_XXXXXXXXXXXXXXXX
OCTOPARSE_API_TOKEN=octo_XXXXXXXXXXXXXXXX
```

---

## SSL & Reverse Proxy Settings
We recommend using **Nginx** as a reverse proxy alongside **Certbot** for automatic Let's Encrypt SSL certificates:
```nginx
server {
    listen 80;
    server_name dataminer.io;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
}
```

---

## First-Run Operations
1. Pull images and launch containers:
   ```bash
   docker compose up -d --build
   ```
2. Verify databases are reachable:
   ```bash
   docker logs express_backend_container
   ```
3. Run initialization scripts to seed custom roles and create standard SQL Server indexes:
   ```bash
   docker exec -it express_backend_container node scripts/create_indexes.js
   ```
Your RetailOps platform is now fully deployed and ready for use!
