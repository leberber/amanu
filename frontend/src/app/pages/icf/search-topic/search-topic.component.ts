

import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';




interface Book {
  id: number;
  title: string;
  description: string;
  author: string;
  year: number;
}

@Component({
  selector: 'app-search-topic',
  standalone: true, // Marking as standalone for modern Angular (if applicable)
  imports: [CommonModule, HttpClientModule],
  templateUrl: './search-topic.component.html',
  styleUrls: ['./search-topic.component.scss'],
})
export class SearchTopicComponent implements OnInit {
  title = 'icf';
  books: Book[] = [];
  APIURL = 'http://127.0.0.1:8000/';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.getBooks();
  }

  // Function to fetch books from the API
  getBooks(): void {
    this.http.get<Book[]>(`${this.APIURL}books`).subscribe({
      next: (res) => {
        this.books = res; // Populate books with the API response
      },
      error: (err) => {
        console.error('Error fetching books:', err); // Handle error
      },
      complete: () => {
        console.log('Books fetch completed');
      }
    });
  }
}


// import { Component } from '@angular/core';

// @Component({
//   selector: 'app-search-topic',
//   imports: [],
//   templateUrl: './search-topic.component.html',
//   styleUrl: './search-topic.component.scss'
// })
// export class SearchTopicComponent {

// }
