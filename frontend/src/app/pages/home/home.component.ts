// src/app/pages/home/home.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule, TranslateModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  categories = [
    { 
      name: 'home.categories.fresh_fruits.name',
      description: 'home.categories.fresh_fruits.description',
      image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80',
      link: '/products?category=1'
    },
    { 
      name: 'home.categories.fresh_vegetables.name',
      description: 'home.categories.fresh_vegetables.description',
      image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=2'
    },
    { 
      name: 'home.categories.organic_produce.name',
      description: 'home.categories.organic_produce.description',
      image: 'https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=3'
    }
  ];
}