import { Component, ChangeDetectorRef, Injectable, Input } from '@angular/core';
import * as tagJSON from '../assets/json/tags.json';

@Component({
  selector: 'pm-card',
  templateUrl: 'card.component.html',
  styleUrls: ['card.component.css']
})

@Injectable()
export class CardComponent {

  // Make @inputs for all the variables that are passed in
  @Input() title: string;
  @Input() imageURL: string;
  @Input() streamer: string;
  @Input() streamURL: string;
  @Input() streamerURL: string;
  @Input() avatarURL: string;
  @Input() tags: Array<string>;
  @Input() viewers: number;
  @Input() viewerString: string;
  @Input() status: string;
  @Input() buttonString: string;
  @Input() favorite: boolean;

  constructor(private cdr: ChangeDetectorRef) {
    this.title = 'Shina Inu vs Jōmon Dog - VALORANT Champions: Berlin - Finals';
    this.imageURL = 'https://material.angular.io/assets/img/examples/shiba2.jpg';
    this.streamer = 'Shiba Inu';
    this.streamURL = 'https://www.twitch.tv/shiba_inu';
    this.streamerURL = 'shiba_inu';
    this.avatarURL = 'https://material.angular.io/assets/img/examples/shiba1.jpg';
    this.tags = ['English', 'Esport', 'Valorant'];
    this.viewers = 0;
    this.viewerString = '';
    this.status = 'OFFLINE';
    this.buttonString = 'View Channel on Twitch';
    this.favorite = false;
  }

  tagMap = new Map(Object.entries(tagJSON));

  humanizeTag(tag: string) {
    return this.tagMap.get(tag);
  }

  toggleFavorite(input: string){
    let favorites = localStorage.getItem('favorites');
    if (favorites == null) {
      let favoritesArray = [];
      favoritesArray.push(input);
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
    else {
      let favoritesArray = JSON.parse(favorites);
      if (favoritesArray.includes(input)) {
        favoritesArray.splice(favoritesArray.indexOf(input), 1);
      }
      else {
        favoritesArray.push(input);
      }
      localStorage.setItem('favorites', JSON.stringify(favoritesArray));
    }
    this.cdr.detectChanges();
  }

  twitchColor = this.getTwitchColor();

  getTwitchColor() {
    let colors = ['#ffb547', '#0598eb', '#9147ff', '#fa2929', '#239b8b', '#0013a3', '#ff6b9f', '#ca435e', '#ffbf00', '#fbff00', '#220056', '#c80000'];
    return colors[Math.floor(Math.random()*colors.length)]
  }

  jsLink(url: string){
    window.open(url, "_blank");
  }

  

}
