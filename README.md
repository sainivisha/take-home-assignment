# Inventory Management Project

This repository contains a code review, database design, and API implementation for an inventory management system.

---

## Part 1: Code Review & Debugging

### Issues Identified

1. **Missing Input Validation**

   - **Issue:** No validation of incoming request data. Missing fields can cause `KeyError`.
   - **Production Impact:** API crashes with 500 errors when clients send incomplete payloads.
   - **Solution:** Use a library like **Zod** for input validation.

2. **No Transaction Management**

   - **Issue:** Two separate commits create a race condition. If the second commit fails, orphaned products remain without inventory.
   - **Production Impact:** Data inconsistency; products exist but can't be sold.

3. **Missing SKU Uniqueness Constraint**

   - **Issue:** No check for duplicate SKUs before insertion.
   - **Production Impact:** Database constraint violation errors (if a unique index exists) or duplicate SKUs, breaking business logic.

4. **No Error Handling**

   - **Issue:** Database errors, connection issues, or constraint violations crash the endpoint.
   - **Production Impact:** Poor user experience, unclear error messages, difficult debugging.

5. **Missing HTTP Status Codes**

   - **Issue:** Returns 200 for all responses, even failures.
   - **Production Impact:** Clients can't distinguish success from failure programmatically.

6. **Decimal Precision Not Specified**

   - **Issue:** Price field might lose precision if not properly typed in the database.
   - **Production Impact:** Financial calculations become inaccurate over time.

7. **No Authentication/Authorization**

   - **Issue:** Anyone can create products for any warehouse.
   - **Production Impact:** Security vulnerability allowing unauthorized access.

8. **Missing Response Data**
   - **Issue:** Doesn't return the created product details for client use.
   - **Production Impact:** Clients need additional API calls to fetch product data.

### Corrected Implementation

- The corrected code can be found in: `part1-code-review.js`

---

## Part 2: Database Design

- PostgreSQL schema used (Prisma ORM can also be used for type-safe queries).
- SQL code is in: `part2-database-design.sql`

---

## Part 3: API Implementation

- JavaScript code for low-stock alerts and related APIs is in: `part3-low-stock-alerts.js`
