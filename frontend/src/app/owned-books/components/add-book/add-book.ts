import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-add-book',
  templateUrl: './add-book.html',
  styleUrl: './add-book.scss',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
})
export class AddBook {
  book = {
    title: '',
    author: '',
    isbn: '',
    format: '',
    authorGender: 'male',
    rating: null as number | null,
    purchaseLocation: '',
    publicationYear: null as number | null,
  };

  isRead = false;

  addBook() {
    //TODO add book logic will go here
  }
}
