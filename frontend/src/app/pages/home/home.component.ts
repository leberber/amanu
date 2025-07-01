// src/app/pages/home/home.component.ts
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, ButtonModule, CardModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  categories = [
    { 
      name: 'Fresh Fruits', 
      description: 'Fresh and seasonal fruits', 
      image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=1470&q=80',
      link: '/products?category=1'
    },
    { 
      name: 'Fresh Vegetables', 
      description: 'Fresh and seasonal vegetables', 
      image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=2'
    },
    { 
      name: 'Organic Produce', 
      description: 'Certified organic fruits and vegetables', 
      image: 'https://images.unsplash.com/photo-1576675466969-38eeae4b41f6?auto=format&fit=crop&w=1442&q=80',
      link: '/products?category=3'
    }
  ];
}