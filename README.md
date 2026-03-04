# SQLens

[![Live Demo](https://img.shields.io/badge/Live-Demo-success)](https://purvakumar-dalwadi.github.io/SQLens/)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue)
![Storage](https://img.shields.io/badge/Storage-IndexedDB-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**SQLens** is a browser-based SQL learning and visualization platform that allows users to create databases, run SQL queries, and visually understand how queries execute step-by-step.

The entire application runs **fully in the browser** using **SQLite compiled to WebAssembly (sql.js)** and stores data locally using **IndexedDB**.

---

# Features

## Workspace Management
- Create multiple workspaces
- Each workspace contains its own SQLite database
- Persistent storage using IndexedDB

## Table Editor
- Create tables with custom schemas
- Insert, edit, and delete rows
- Inline editing support
- Primary key support

## SQL Query Runner
- Execute SQL queries directly in the browser
- Supports multiple SQL statements
- Displays results for SELECT queries
- Shows execution logs for DDL and DML queries

## Query Visualization
Understand how SQL queries execute step-by-step.

Visualization includes stages such as:

- FROM
- JOIN
- WHERE
- GROUP BY
- HAVING
- SELECT
- ORDER BY
- LIMIT

## Query History
- Stores executed queries per workspace
- Displays execution time and row count
- Reload previous queries with one click

## CSV Import
- Import CSV files into tables
- Preview CSV before importing
- Automatic column mapping

---

# Tech Stack

Frontend
- Vanilla JavaScript
- HTML5
- CSS

Database
- SQLite (via sql.js WebAssembly)

Storage
- IndexedDB

Architecture
- Modular plain JavaScript components

---

# Architecture Overview

```
App
 ├── Auth
 ├── Workspace
 ├── DBEngine
 ├── QueryParser
 ├── StepBuilder
 ├── AnimationEngine
 └── Visualizer
```

### App
Main controller responsible for UI interaction, navigation, query execution, and visualization.

### Auth
Handles user authentication, registration, and session management.

### Workspace
Manages workspace creation, database persistence, and query history.

### DBEngine
Wrapper around SQLite WASM providing:

- table CRUD operations
- SQL query execution
- CSV import
- database persistence

### QueryParser
Parses SQL SELECT queries into structured objects for visualization.

### StepBuilder
Converts parsed queries into step-by-step execution stages.

### Visualizer
Renders the query execution process visually.

### AnimationEngine
Controls visualization transitions and animations.

---

# Project Structure

```
sqlens/
│
├── index.html
│
├── app.js
│   Main application controller
│
├── auth.js
│   Authentication and session handling
│
├── workspace.js
│   Workspace and query history storage
│
├── dbEngine.js
│   SQLite engine wrapper
│
├── queryParser.js
│   SQL parser for visualization
│
├── stepBuilder.js
│   Query execution step generator
│
├── animationEngine.js
│   Visualization animation engine
│
├── visualizer.js
│   Renders query visualization
│
└── styles.css
    Application styling
```

---

# Installation

Clone the repository

```bash
git clone https://github.com/purvakumar-dalwadi/SQLens.git
```

Navigate into the project

```bash
cd sqlens
```

Open the application

```
index.html
```

No server or build process is required.

---

# Example Query

```sql
SELECT department, COUNT(*)
FROM employees
WHERE salary > 50000
GROUP BY department
ORDER BY COUNT(*) DESC;
```

Visualization steps:

```
1. FROM employees
2. WHERE salary > 50000
3. GROUP BY department
4. SELECT department, COUNT(*)
5. ORDER BY COUNT(*) DESC
```

---

# Data Persistence

All data is stored locally in the browser using **IndexedDB**.

Each workspace stores:
- SQLite database binary
- table metadata
- query history

No external server is required.

---

# Limitations

- Visualization currently supports **SELECT queries only**
- Maximum query result display: **1000 rows**
- Data is stored locally per browser

---

# Future Improvements

- JOIN visualization improvements
- Query execution plan visualization
- ER diagram generator
- Database export/import
- Collaborative workspaces

---

# License

MIT License