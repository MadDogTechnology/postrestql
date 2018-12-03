# postrestql
**Owner(s):** 

# Repo is archived

PostRESTql
==========

PostRESTql is a node server that automatically creates RESTful web services from a connected PostgreSQL database. If also provides a simple way to quickly create custom web services using more complex queries.

## Installation

    npm install postrestql

## Basic Use

The simplest setup looks like this:

    var postrestql = require("postrestql");

    var config = {
        "db_connections": {
            "admin": "postgres://username:password@server:5432/catalog"
        }
    };

    postrestql.start(config);

If the `admin` connection string points to a user on a running PostgreSQL server with sufficient privileges, a web service will be created on port :4100 that will list all tables as HTML pages.

## Configuration Reference

    var config = {
        "db_connections": {
            "admin": "postgres://chrisbroski:@localhost:5432/utilities",
            "web_user": "postgres://chrisbroski:@localhost:5432/utilities"
        },
        "port": 4100,
        "cors": true,
        "sql_folder": "./sql"
        "custom": [
            {
                "name": "totals by month",
                "path": "/month-totals/{{integer}}/{{integer}}",
                "sql_statement": "get_month_totals"
            },
            {
                "name": "totals by month",
                "path": "/month-totals/{{integer}}/{{integer}}",
                "sql": "get_month_totals",
                "default": [2017, 1]
            }
        ]
    };
