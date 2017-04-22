select t.tablename, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type, NULLIF(i.indisprimary, FALSE) AS primary_key
FROM pg_catalog.pg_tables t
	JOIN pg_attribute a ON a.attrelid = t.tablename::regclass
	LEFT OUTER JOIN pg_index i ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) AND i.indisprimary
WHERE schemaname = 'public' AND a.attnum > 0 and not a.attisdropped
ORDER BY t.tablename, a.attnum
