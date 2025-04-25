import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchTopicComponent } from './search-topic.component';

describe('SearchTopicComponent', () => {
  let component: SearchTopicComponent;
  let fixture: ComponentFixture<SearchTopicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchTopicComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchTopicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
