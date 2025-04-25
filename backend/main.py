from typing import Union

from fastapi import FastAPI
from pydantic import BaseModel
from sql_api import PostgesAPI

DATABASE_URL="postgresql://postgres:it is me@localhost:5432/vtx"

sql_api = PostgesAPI( DATABASE_URL )

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware



# CORS Middleware to allow all
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ Allows requests from ANY origin
    allow_credentials=True,
    allow_methods=["*"],  # ✅ Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # ✅ Allows all headers
)


class Book(BaseModel):
    title: str
    description: str
    author: str
    year: int

@app.post("/add-book/")
def add_book(book: Book):
    """Insert a new book into the database"""
    book_data = book.dict()  # Convert Pydantic model to dictionary
    inserted_book = sql_api.safe_insert("books", book_data)  # Insert book
    return {"message": "Book added successfully!", "book": inserted_book}

@app.get("/books/")
def list_books():
    """Retrieve all books from the database"""
    books = sql_api.select("select * from books")
    return  books

@app.get("/books/{book_id}")
def get_book(book_id: int):
    """Retrieve a single book by ID"""
    book = sql_api.select(f"select * from books where id = {book_id}")
    return {"book": book}