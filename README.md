# SQLens — Interactive SQL Visualization Engine

SQLens is a browser-based SQL execution and visualization environment designed to help users understand how SQL queries execute internally.

It provides a step-by-step visual breakdown of SQL query execution, showing intermediate results for clauses like:

FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT

The system runs entirely in the browser using SQLite (via sql.js) and stores workspaces and query history using IndexedDB.

---

## Key Features

### 1. Workspace System

Users can create multiple isolated SQL workspaces.

Each workspace stores:
- Tables
- Data
- Query history
- SQLite database snapshot

Workspaces allow experimentation without affecting other datasets.

---

### 2. Interactive Table Editor

Users can create and manage tables visually.

Supported actions:
- Create tables with schema
- Add rows
- Edit rows inline
- Delete rows
- Import CSV files
- Delete tables

The editor interacts directly with the embedded SQLite engine.

---

### 3. SQL Query Runner

Users can run any SQL query including:

- SELECT
- INSERT
- UPDATE
- DELETE
- CREATE TABLE
- ALTER TABLE
- DROP TABLE

Multiple statements separated by `;` are supported.

The system:
1. Parses statements
2. Executes sequentially
3. Displays execution results
4. Shows execution log for multi-statement queries

---

### 4. SQL Query Visualization

The most important feature of SQLens is query execution visualization.

For SELECT queries, the system:
1. Parses the query
2. Decomposes it into logical steps
3. Executes each step separately
4. Displays intermediate results

**Example:**

```sql
SELECT e.name, d.name
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.salary > 50000
ORDER BY e.name
```

Visualization steps:

1. FROM employees
2. INNER JOIN departments
3. WHERE salary > 50000
4. SELECT projection
5. ORDER BY name

Each step shows:
- SQL query generated
- intermediate rows
- number of rows
- execution time
- columns

---

### 5. Animated Execution

The visualization engine supports animated transitions between steps.

Animations help users understand:
- row filtering
- join results
- grouping operations
- sorting

This makes SQL execution easier to learn.

---

### 6. Query History

Each workspace stores previously executed queries.

History entries include:
- query text
- execution time
- row count
- timestamp

Clicking a history item reloads the query into the SQL editor.

---

### 7. CSV Import

Users can import datasets using CSV files.

Features:
- drag and drop
- preview before import
- automatic insertion into table
- batch row insertion

---

## System Architecture

The system is organized into modular components.

```
SQLens
│
├── app.js
├── auth.js
├── workspace.js
├── dbEngine.js
├── queryParser.js
├── stepBuilder.js
├── visualizer.js
├── animationEngine.js
└── index.html
```

Each module has a specific responsibility.

---

### Core Modules

#### app.js

Main application controller.

Responsibilities:
- UI interactions
- navigation between screens
- query execution
- visualization trigger
- table editor integration
- history loading

It coordinates all other modules.

---

auth.js

Handles user authentication.

Features:
- register users
- login
- store sessions
- manage user identity

Authentication data is stored in IndexedDB.

---

workspace.js

Manages workspaces and query history.

Functions:
- create workspace
- list workspaces
- load workspace
- delete workspace
- save query history
- retrieve history

Each workspace stores a serialized SQLite database.

---

dbEngine.js

Core database engine.

Uses:
- sql.js (SQLite compiled to WebAssembly)

Responsibilities:
- execute SQL statements
- return query results
- manage tables
- import CSV data
- export database state

---

queryParser.js

Parses SELECT queries into components.

Extracts:
- SELECT columns
- FROM tables
- JOIN clauses
- WHERE conditions
- GROUP BY
- HAVING
- ORDER BY
- LIMIT

Output is a structured object used by the visualization system.

**Example parsed structure:**

```
{
  selectCols: "...",
  baseFrom: "...",
  joins: [...],
  where: "...",
  groupBy: "...",
  having: "...",
  orderBy: "...",
  limit: "..."
}
```

---

stepBuilder.js

Builds execution steps from the parsed query.

Each step corresponds to a logical SQL stage.

**Example step:**

```
{
  name: "WHERE",
  sql: "SELECT * FROM employees WHERE salary > 50000",
  color: "#f472b6"
}
```

Supported steps:
- FROM
- JOIN
- WHERE
- GROUP BY
- HAVING
- SELECT
- ORDER BY
- LIMIT

The module also executes each step to produce intermediate results.

---

visualizer.js

Responsible for displaying query execution steps.

Functions:
- render timeline
- render step results
- display SQL for each stage
- show row counts
- highlight active step

Users can navigate between steps interactively.

---

animationEngine.js

Handles visual animations between steps.

Examples:
- row appearance
- row filtering
- table updates
- transitions between query stages

This improves learning and comprehension.

---

index.html

Defines the UI layout.

Contains screens for:
- Authentication
- Dashboard
- Workspace
- SQL Editor
- Visualization Panel

The interface includes:
- SQL editor
- table editor
- visualization timeline
- result tables

---

## Data Storage

SQLens uses two browser storage systems.

### IndexedDB

Stores:
- users
- workspaces
- query history

### SQLite (sql.js)

Stores:
- tables
- rows
- schema

SQLite runs entirely in the browser using WebAssembly.

---

## Query Execution Flow

When a query is visualized:

User enters SQL query
        ↓
QueryParser parses SQL
        ↓
StepBuilder generates execution steps
        ↓
Each step executes partial SQL
        ↓
Visualizer renders results
        ↓
AnimationEngine animates transitions

This allows users to see how SQL queries transform data step-by-step.

---

## Example Visualization

Query:

```sql
SELECT name
FROM employees
WHERE salary > 50000
ORDER BY name;
```

Steps generated:

1 FROM employees
2 WHERE salary > 50000
3 SELECT name
4 ORDER BY name

Each step shows intermediate results.

---

## Technologies Used

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript

### Database
- SQLite via sql.js (WebAssembly)

### Storage
- IndexedDB

No backend server is required.

---

## Educational Value

SQLens is designed primarily for:
- SQL learners
- database students
- teaching query execution
- understanding relational algebra concepts

It makes invisible SQL operations visible.

---

## Future Improvements

Potential enhancements include:
- visual join diagrams
- query execution tree
- cost estimation
- index simulation
- aggregation visualization
- query plan comparison

---

## Summary

SQLens provides an interactive SQL execution environment with visualization capabilities.

It helps users:
- write SQL queries
- explore relational data
- understand how queries execute internally
- visualize intermediate results step-by-step

The entire system runs client-side in the browser, making it lightweight and easy to deploy.
