/*jslint node: true, sloppy: true */

var http = require("http");
var pg = require("pg");
var fs = require("fs");
var mustache = require("Mustache");

var config;
var templates = {};
var sql = {};
var routes = [];
var data_defintion = {};
var app_name;
var user_name;

function htmlEncode(rawHtml) {
    rawHtml = rawHtml || "";
    rawHtml = rawHtml.toString();
    rawHtml = rawHtml.replace(/</g, "&lt;");
    return rawHtml.replace(/>/g, "&gt;");
}

function respondJson(rsp, data) {
    rsp.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
    });
    rsp.end(JSON.stringify(data, ""));
}

function primaryKey(table) {
    var keyField = Object.keys(data_defintion[table]).find(function (col) {
        return data_defintion[table][col].primary_key;
    });

    if (keyField) {
        return data_defintion[table][keyField];
    }
    return {"type": "false"};
}

function respondHTML(rsp, data, page_name, type, table) {
    var form_partial = {},
        table_data = {};

    type = type || "table";
    if (data.length === 0) {
        rsp.writeHead(404, {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
        });
        rsp.end("No data found.");
        return;
    }

    if (type === "table") {
        form_partial = {form: templates.form};
    }

    rsp.writeHead(200, {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*"
    });

    table_data.cols = [];
    Object.keys(data[0]).forEach(function (key) {
        table_data.cols.push(key);
    });

    table_data.rows = [];
    data.forEach(function (row) {
        var row_data = [];
        Object.keys(row).forEach(function (val) {
            if (table) {
                if (data_defintion[table][val].primary_key) {
                    row_data.push("<a href=\"/" + table + "/" + htmlEncode(row[val]) + "\">" + htmlEncode(row[val]) + "</a>");
                } else {
                    row_data.push(htmlEncode(row[val]));
                }
            } else {
                row_data.push(htmlEncode(row[val]));
            }
        });
        table_data.rows.push(row_data);
    });

    table_data.pairs = [];
    Object.keys(data[0]).forEach(function (row) {
        var pair = {};
        pair.name = row;
        pair.val = data[0][row];

        if (table) {
            pair.type = data_defintion[table][row].type;
            pair.key = data_defintion[table][row].primary_key;
            pair.label = row.replace(/\_/g, " ");
        }

        table_data.pairs.push(pair);
    });

    rsp.end(mustache.render(templates.doc, {
        "page_content": mustache.render(templates[type], table_data, form_partial),
        "page_title": page_name,
        "app_name": app_name,
        "user_name": user_name
    }), "utf-8");
}

function respondHTMLhome(rsp, data) {
    var home_data = {};
    home_data.tables = data;
    home_data.custom = [];

    routes.forEach(function (route) {
        var path = route.path;

        if (route.type === "custom") {
            // add defaults, if any
            if (route.default) {
                route.default.forEach(function (def) {
                    path = path.replace(/\{\{\w+\}\}/, def);
                });
            }

            home_data.custom.push({"name": route.name, "path": path});
        }
    });

    rsp.writeHead(200, {
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*"
    });

    rsp.end(mustache.render(templates.doc, {
        "page_content": mustache.render(templates.home, home_data),
        "app_name": app_name,
        "user_name": user_name
    }), "utf-8");
}

function executeSql(req, rsp, route) {
    var client = new pg.Client(config.db_connections.web_user);
    var sql_statement;
    var json_data = [];

    client.connect();

    if (route[0].sql_statement) {
        sql_statement = route[0].sql_statement;
    } else {
        sql_statement = sql[route[0].sql];
    }

    var query;
    if (sql_statement.indexOf("$") > -1) {
        query = client.query(sql_statement, route.slice(1));
    } else {
        query = client.query(sql_statement);
    }

    query.on("error", function (error) {
        console.log(error);
        rsp.writeHead(500, {
            "Content-Type": "text/plain",
            "Access-Control-Allow-Origin": "*"
        });
        rsp.end("SQL error.");
        return;
    });

    query.on("row", function (row) {
        var jsonRow = {};

        Object.keys(row).forEach(function (col) {
            jsonRow[col] = row[col];
        });

        json_data.push(jsonRow);
    });

    query.on("end", function () {
        client.end();

        if (req.headers.accept === "application/json") {
            respondJson(rsp, json_data);
        } else {
            if (req.url === "/") {
                respondHTMLhome(rsp, json_data);
            } else {
                respondHTML(rsp, json_data, route[0].name, route[0].type, route[0].table);
            }
        }
    });
}

function matchRoute(url) {
    // remove query string
    var queryStringStart = url.indexOf("?");
    if (queryStringStart > -1) {
        url = url.slice(0, queryStringStart);
    }

    var route;
    var path;
    var route_and_data = [];

    route = routes.find(function (r) {
        path = r.path.replace(/\{\{text\}\}/g, "(\\w+)");
        path = path.replace(/\{\{integer\}\}/g, "(\\d+)");
        var re = new RegExp("^" + path + "$", "i");
        return re.exec(url);
    });

    if (route) {
        path = route.path.replace(/\{\{text\}\}/g, "(\\w+)");
        path = path.replace(/\{\{integer\}\}/g, "(\\d+)");
        var re = new RegExp("^" + path + "$", "i");
        route_and_data = re.exec(url).slice(1);
        route_and_data.unshift(route);
    }
    return route_and_data;
}

function routeMethods(req, rsp) {
    var route = matchRoute(req.url);

    if (route.length) {
        if (req.method.toUpperCase() !== "GET") {
            rsp.writeHead(405, {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
            });
            rsp.end("Only GET is supported at this time.");
            return;
        }
        if (!route[0].method || req.method.toUpperCase() === route[0].method.toUpperCase()) {
            executeSql(req, rsp, route);
            return;
        }
    }

    rsp.writeHead(404, {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": "*"
    });
    rsp.end("Not found.");
}

function createDefaultRoutes() {
    routes.push({
        "name": "Home",
        "path": "/",
        "sql": "public_tables",
        "type": "system"
    });

    Object.keys(data_defintion).forEach(function (table) {
        var id_param_type = "$1::integer";
        var id_url_type = "{{integer}}";

        routes.push({
            "name": table + " table",
            "path": "/" + table,
            "sql_statement": "SELECT * FROM " + table,
            "type": "table",
            "table": table
        });

        if (primaryKey(table).type === "text") {
            id_param_type = "$1::text";
            id_url_type = "{{text}}";
        }

        routes.push({
            "name": table + " record",
            "path": "/" + table + id_url_type,
            "sql_statement": "SELECT * FROM " + table + " WHERE id = " + id_param_type,
            "type": "form",
            "table": table
        });
    });
}

function getTableInfo() {
    var client = new pg.Client(config.db_connections.admin);
    client.connect();

    var query = client.query(sql.get_db_info);

    query.on("row", function (row) {
        if (!data_defintion[row.tablename]) {
            data_defintion[row.tablename] = {};
        }

        data_defintion[row.tablename][row.column_name] = {};
        data_defintion[row.tablename][row.column_name].type = row.data_type;
        data_defintion[row.tablename][row.column_name].primary_key = row.primary_key;
    });

    query.on("end", function () {
        client.end();
        createDefaultRoutes();
    });
}

function createDataDefinition() {
    var client = new pg.Client(config.db_connections.admin);
    client.connect();

    var query = client.query("SELECT current_catalog, current_user");

    query.on("row", function (row) {
        app_name = row.current_database.replace(/\_/g, " ");
        user_name = row.current_user;
    });

    query.on("end", function () {
        client.end();
        getTableInfo();
    });
}

function importTemplates() {
    console.log("Reading mustache templates.");
    var template_files = fs.readdirSync(__dirname + "/templates");

    template_files.forEach(function (file) {
        var name = file.split(".")[0];
        templates[name] = fs.readFileSync(__dirname + "/templates/" + file).toString();
    });
}

function importSQL() {
    console.log("Reading SQL files.");
    var sys_sql_files = fs.readdirSync(__dirname + "/sys_sql");

    sys_sql_files.forEach(function (file) {
        var filenames = file.split(".");
        var file_extension = filenames[filenames.length - 1];

        sql[filenames[0]] = fs.readFileSync(__dirname + "/sys_sql/" + file).toString();
    });

    if (config.sql_folder) {
        var sql_files = fs.readdirSync(config.sql_folder);

        sql_files.forEach(function (file) {
            var filenames = file.split(".");
            var file_extension = filenames[filenames.length - 1];

            sql[filenames[0]] = fs.readFileSync(config.sql_folder + "/" + file).toString();
        });
    } else {
        console.log('No custom SQL folder defined.');
    }
}

function init(cfg) {
    config = cfg;
    var port = config.port || 4100

    // import custom routes, if any
    if (config.custom && Array.isArray(config.custom)) {
        config.custom.forEach(function (route) {
            route.type = "custom";
            routes.push(route);
        });
    } else {
        console.log('No custom routes found');
    }

    importSQL();
    importTemplates(config.template_folder);
    createDataDefinition();

    http.createServer(routeMethods).on('error', function (e) {
        console.log(e)
    }).listen(port, "0.0.0.0", function () {
        console.log("Server started on port :" + port);
    });
}

/*
3. Check for PUT/POST/DELETE and do appropriate action
5. Format based on data types
6. Input validate based on db types
7. Link from foreign keys
8. Handle composite keys (how? that's a tough one)
*/

exports.start = init;
