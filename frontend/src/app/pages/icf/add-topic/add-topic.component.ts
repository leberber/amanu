import { Component} from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Book {
  title: string;
  description: string;
  author: string;
  year: number;
}

@Component({
  selector: 'app-add-topic',
  standalone: true, // Ensure Angular knows it's a standalone component
  imports: [InputTextModule, CardModule, ButtonModule, InputNumberModule, ReactiveFormsModule, CommonModule, HttpClientModule],
  templateUrl: './add-topic.component.html',
  styleUrl: './add-topic.component.scss'
})
export class AddTopicComponent {

  bookForm: FormGroup = new FormGroup({
    title: new FormControl("", [Validators.required]),
    author: new FormControl("", [Validators.required]),
    description: new FormControl("", [Validators.required]),
    year: new FormControl(null, [Validators.required, Validators.min(1000), Validators.max(new Date().getFullYear())]),
  });

  books: Book[] = []; // Store fetched books
  APIURL = 'http://127.0.0.1:8000/';

  constructor(private http: HttpClient) {}



  // Submit form and post book to API
  onUserSave(): void {
    if (this.bookForm.valid) {
      const newBook: Book = this.bookForm.value;
      this.http.post<{ message: string; book: Book }>(`${this.APIURL}add-book/`, newBook).subscribe({
        next: (res) => {
          console.log(res.message); // Log success message
          this.books.push(res.book); // Add new book to list
          this.bookForm.reset(); // Clear form
        },
        error: (err) => console.error('Error adding book:', err),
        complete: () => console.log('Book submission completed')
      });
    } else {
      console.error('Form is invalid');
    }
  }


}