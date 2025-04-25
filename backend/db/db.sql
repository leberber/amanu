DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS itms;

CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    title TEXT,
    description TEXT,
    author TEXT,
    year INT
);

