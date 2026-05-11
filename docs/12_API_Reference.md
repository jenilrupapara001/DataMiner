# API Reference Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication Endpoints](#authentication-endpoints)
3. [ASIN Management Endpoints](#asin-management-endpoints)
4. [Sellers & Store Endpoints](#sellers--store-endpoints)
5. [Collaboration Tasks Endpoints](#collaboration-tasks-endpoints)

---

## Overview
All API requests must include a valid JSON Web Token (JWT) in the `Authorization` header as a Bearer token (except `/api/auth/login`). Responses are returned in a consistent JSON format:
```json
{
  "success": boolean,
  "data": object | array,
  "error": string
}
```

---

## Authentication Endpoints

### 1. Login User
* **Method**: `POST`
* **URL**: `/api/auth/login`
* **Headers**: `Content-Type: application/json`
* **Payload**:
  ```json
  {
    "email": "admin@company.com",
    "password": "SecurePassword123"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "u-49b3-a934-dcd4a632",
      "email": "admin@company.com",
      "role": "super_admin"
    }
  }
  ```

---

## ASIN Management Endpoints

### 1. Get All ASINs
* **Method**: `GET`
* **URL**: `/api/asins`
* **Headers**: `Authorization: Bearer <token>`
* **Params**: `page` (default 1), `limit` (default 25), `search`, `sellerId`, `status`
* **Response**:
  ```json
  {
    "success": true,
    "data": {
      "asins": [
        {
          "id": "a-7693b688-e297-49b3",
          "asinCode": "B08N5WRWNW",
          "sku": "SKU-AMZ-09",
          "price": 1499.00,
          "status": "Active"
        }
      ],
      "pagination": { "total": 125, "page": 1, "pages": 5 }
    }
  }
  ```

### 2. Add New ASINs (Bulk)
* **Method**: `POST`
* **URL**: `/api/asins/bulk`
* **Payload**:
  ```json
  [
    {
      "asinCode": "B08N5WRWNW",
      "sellerId": "s-e297-49b3-a934",
      "status": "Active"
    }
  ]
  ```
* **Response**:
  ```json
  {
    "success": true,
    "message": "Successfully added 1 ASIN(s) to the tracking pool."
  }
  ```

---

## Sellers & Store Endpoints

### 1. Create Seller
* **Method**: `POST`
* **URL**: `/api/sellers`
* **Payload**:
  ```json
  {
    "name": "Cloud Retail IN",
    "marketplace": "Amazon",
    "octoparseTaskId": "task_98b50e2ddc"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "data": {
      "id": "s-e297-49b3-a934",
      "name": "Cloud Retail IN",
      "marketplace": "Amazon"
    }
  }
  ```

---

## Collaboration Tasks Endpoints

### 1. Update Task Progress Stage
* **Method**: `PUT`
* **URL**: `/api/actions/:id`
* **Payload**:
  ```json
  {
    "stage": "In_Progress",
    "assignedTo": "user-88d3"
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "data": { "id": "task-094c", "stage": "In_Progress" }
  }
  ```
