import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { ToastMessageService } from '../../core/services/toast-message.service';
import { ROUTES } from '../../core/constants/routes.constants';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    FormsModule,
    TranslateModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    PageLayoutComponent
  ],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  private toast = inject(ToastMessageService);

  readonly routes = ROUTES;

  formData: ContactFormData = {
    name: '',
    email: '',
    subject: '',
    message: ''
  };

  sending = signal(false);

  onSubmit(): void {
    if (!this.formData.name || !this.formData.email || !this.formData.subject || !this.formData.message) {
      return;
    }

    this.sending.set(true);

    setTimeout(() => {
      this.toast.showSuccess('contact.success_title', 'contact.success_message');
      this.resetForm();
      this.sending.set(false);
    }, 1500);
  }

  private resetForm(): void {
    this.formData = { name: '', email: '', subject: '', message: '' };
  }
}
