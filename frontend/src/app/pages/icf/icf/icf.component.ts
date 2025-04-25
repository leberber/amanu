import { Component } from '@angular/core';
import { SearchTopicComponent } from '../search-topic/search-topic.component';
import { AddTopicComponent } from '../add-topic/add-topic.component';


@Component({
  selector: 'app-icf',
  imports: [SearchTopicComponent, AddTopicComponent],
  templateUrl: './icf.component.html',
  styleUrl: './icf.component.scss'
})
export class IcfComponent {

}
