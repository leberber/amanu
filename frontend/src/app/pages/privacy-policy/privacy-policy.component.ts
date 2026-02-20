import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="surface-ground min-h-screen p-4">
      <div class="surface-card border-round p-4 md:p-6 max-w-4xl mx-auto">
        <h1 class="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p class="text-500 mb-4"><strong>Effective Date:</strong> 30/01/2026</p>

        <p class="line-height-3 mb-4">
          AgroClik ("we", "us", or "our") operates the AgroClik mobile application (the "Service").
          This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
        </p>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">1. Introduction</h2>
          <p class="line-height-3">
            This Service is provided by AgroClik at no cost and is intended for use as is. By using the Service, you agree to the collection and use of information in accordance with this policy.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">2. Information Collection and Use</h2>
          <p class="line-height-3">
            For a better experience, while using our Service, we may require you to provide us with certain personally identifiable information, specifically for business operations. The information that we request will be retained by us and used as described in this privacy policy.
          </p>
          <p class="line-height-3 mt-2">
            The app uses third-party services that may collect information used to identify you.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">3. Log Data</h2>
          <p class="line-height-3">
            We want to inform you that whenever you use our Service, in a case of an error in the app, we collect data and information (through third-party products) on your phone called Log Data. This Log Data may include information such as your device Internet Protocol ("IP") address, device name, operating system version, the configuration of the app when utilizing our Service, the time and date of your use of the Service, and other statistics.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">4. Cookies</h2>
          <p class="line-height-3">
            Cookies are files with a small amount of data that are commonly used as anonymous unique identifiers. These are sent to your browser from the websites that you visit and are stored on your device's internal memory.
          </p>
          <p class="line-height-3 mt-2">
            This Service does not use these "cookies" explicitly. However, the app may use third-party code and libraries that use "cookies" to collect information and improve their services. You have the option to either accept or refuse these cookies and know when a cookie is being sent to your device. If you choose to refuse our cookies, you may not be able to use some portions of this Service.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">5. Service Providers</h2>
          <p class="line-height-3">We may employ third-party companies and individuals due to the following reasons:</p>
          <ul class="list-disc pl-4 line-height-3 mt-2">
            <li>To facilitate our Service;</li>
            <li>To provide the Service on our behalf;</li>
            <li>To perform Service-related services; or</li>
            <li>To assist us in analyzing how our Service is used.</li>
          </ul>
          <p class="line-height-3 mt-2">
            We want to inform users of this Service that these third parties have access to your Personal Information. The reason is to perform the tasks assigned to them on our behalf. However, they are obligated not to disclose or use the information for any other purpose.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">6. Security</h2>
          <p class="line-height-3">
            We value your trust in providing us your Personal Information, thus we are striving to use commercially acceptable means of protecting it. But remember that no method of transmission over the internet, or method of electronic storage is 100% secure and reliable, and we cannot guarantee its absolute security.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">7. Children's Privacy</h2>
          <p class="line-height-3">
            These Services do not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. In the case we discover that a child under 13 has provided us with personal information, we immediately delete this from our servers. If you are a parent or guardian and you are aware that your child has provided us with personal information, please contact us so that we will be able to do the necessary actions.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">8. Changes to This Privacy Policy</h2>
          <p class="line-height-3">
            We may update our Privacy Policy from time to time. Thus, you are advised to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page.
          </p>
        </section>

        <section class="mb-4">
          <h2 class="text-xl font-semibold mb-2">9. Contact Us</h2>
          <p class="line-height-3">
            If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at
            <a href="mailto:support@agroclik.com" class="text-primary">support&#64;agroclik.com</a>.
          </p>
        </section>
      </div>
    </div>
  `
})
export class PrivacyPolicyComponent {}
