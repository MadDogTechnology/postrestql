PostRESTql
==========

PostRESTql is a node server that automatically creates RESTful web services from a connected PostgreSQL database. If also provides a simple way to quickly create custom web services using more complex queries.

## Installation

    npm install postrestql

## Basic Use

A simple setup looks like this:

    var postrestql = require("postrestql");

    var config = {
        "db_connections": {
            "admin": "postgres://username:password@server:5432/catalog",
            "web_user": "postgres://username:password@server:5432/catalog"
        },
        "cors" true
    };

    postrestql.start(config);

If the `admin` and `web_user` connection strings point to users on running PostgreSQL server with sufficient privileges, a web service will be created on port :4100 that will list all tables as HTML pages.
