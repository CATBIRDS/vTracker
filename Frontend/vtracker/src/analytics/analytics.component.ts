import { Component, ElementRef, Injectable, Input, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChartConfiguration, ChartEvent, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { MatChipInputEvent } from '@angular/material/chips';
import { FormControl } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';

import { vtuberService } from 'src/api/service';

@Component({
  selector: 'pm-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
  providers: [vtuberService]
})

@Injectable()
export class AnalyticsComponent {
    @Input() pageTitle: string;
    @Input() monthViewOptions: ChartConfiguration['options'];
    @Input() dayViewOptions: ChartConfiguration['options'];
    @Input() monthTimeOptions: ChartConfiguration['options'];
    @Input() dayTimeOptions: ChartConfiguration['options'];

    @Input() monthViewData: ChartConfiguration['data'];
    @Input() dayViewData: ChartConfiguration['data'];
    @Input() monthTimeData: ChartConfiguration['data'];
    @Input() dayTimeData: ChartConfiguration['data'];
    
    lineChartType: ChartType = 'line';
    // Storage for the history.json data. Not a true cache, serves to prevent multiple requests on a single page load. Unga bunga.
    cache: any = {};

    // Debug cache
    dummycache: any = {
        'kazuya': {
            '2021' : {
                'October': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'November': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'December': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                }
            },
        },
        'bingus': {
            '2021' : {
                'October': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'November': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'December': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                }
            },
        }
    };

    // Storage for the data needed to generate charts for view and time stats, respectively.
    view: any = {}
    time: any = {}

    public tags: string[] = [];
    placeholder = 'e.g. ';
    tagCtrl: FormControl = new FormControl();
    separatorKeysCodes: number[] = [ENTER, COMMA];

    tagError = false;
    

    constructor(private route: ActivatedRoute, private vtubers:vtuberService, public tagInput: ElementRef<HTMLInputElement>) {
        
        this.monthViewData = { datasets: [], labels: [] };
        this.dayViewData = { datasets: [], labels: [] };
        this.monthTimeData = { datasets: [], labels: [] };
        this.dayTimeData = { datasets: [], labels: [] };

        this.monthViewOptions = {
            plugins: { title: { display: true, text: 'Average Monthly Views' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.dayViewOptions = {
            plugins: { title: { display: true, text: 'Average Daily Views' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.monthTimeOptions = {
            plugins: { title: { display: true, text: 'Average Stream Duration by Month' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.dayTimeOptions = {
            plugins: { title: { display: true, text: 'Stream Duration by Day' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };

        this.pageTitle = 'Analytics';
    }

    // Chip Functions

    add(event: MatChipInputEvent): void {
        const value = (event.value || '').trim();

        // Add our tag
        if (value) {
            // Only allow new and unique tags that correspond to valid vtubers
            if (this.cache[value] && !this.tags.includes(value) && this.route.snapshot.paramMap.get('id') != value) {

                // Add the tag to the tags array
                this.tags.push(value.toLowerCase());

                // Graph the tag data
                this.firstRun(value.toLowerCase());

                // Clear the input value
                event.chipInput!.clear();

                this.tagCtrl.setValue(null);

                // Set a new placeholder now that we've entered some text
                this.placeholder = this.randomTag();
            }
            // If the value is invalid, display error text
            else {
                this.tagCtrl.setErrors({'invalid': true});
            }
            
        }
    }

    remove(tag: string): void {
        const index = this.tags.indexOf(tag);

        if (index >= 0) {
        this.tags.splice(index, 1);
        }

        // Remove data from graph
        this.pruneSet(tag);

        // As with add(), change up the placeholder text
        this.placeholder = this.randomTag();
    }

    selected(event: MatAutocompleteSelectedEvent): void {
        this.tags.push(event.option.viewValue);
        this.tagInput.nativeElement.value = '';
        this.tagCtrl.setValue(null);
    }

    randomTag(): string {
        console.log(this.cache);
        let keys = Object.keys(this.cache);
        return 'e.g. ' + keys[Math.floor(Math.random() * keys.length)];
        
    }

    @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

    getPastelColor(){ 
        return "hsla(" + 360 * Math.random() + ',' +
                   (25 + 70 * Math.random()) + '%,' + 
                   (85 + 10 * Math.random()) + '%, 1)'; 
    }

    pruneSet(username: string){
        for (let dataset in this.monthViewData.datasets){
            if (this.monthViewData.datasets[dataset].label == username){
                // Remove the dataset
                this.monthViewData.datasets.splice(+dataset, 1);
            }
        }
        for (let dataset in this.monthTimeData.datasets){
            if (this.monthTimeData.datasets[dataset].label == username){
                // Remove the dataset
                this.monthTimeData.datasets.splice(+dataset, 1);
                console.log('removed monthtime dataset');
            }
        }
        for (let dataset in this.dayViewData.datasets){
            if (this.dayViewData.datasets[dataset].label == username){
                // Remove the dataset
                this.dayViewData.datasets.splice(+dataset, 1);
                console.log('removed dayview dataset');
            }
        }
        for (let dataset in this.dayTimeData.datasets){
            if (this.dayTimeData.datasets[dataset].label == username){
                // Remove the dataset
                this.dayTimeData.datasets.splice(+dataset, 1);
                console.log('removed daytime dataset');
            }
        }
        this.charts?.toArray().forEach(chart => {chart.update()});
    }

    generateDataSet(data: any, type: string, scope: string, vtuber: string | null, username: string, mode: string = 'replace') {
        if (vtuber === null) {
            return;
        }
        let color = this.getPastelColor();
        let dataset = [];
        let labels = [];
        switch(scope) {
            case 'month':
                for (let month in data[vtuber]) {
                    if (month != 'daily') {
                        dataset.push(this.view[vtuber][month][0]);
                        labels.push(month);
                    }
                }
                if (type == 'view') {
                    this.monthViewData.datasets.push(
                        {
                            data: dataset,
                            label: username,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.monthViewData.labels = labels;
                }
                else if (type == 'time') {
                    this.monthTimeData.datasets.push(
                        {
                            data: dataset,
                            label: username,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.monthTimeData.labels = labels;
                }
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
            case 'day':
                dataset = data[vtuber]['daily'][Object.keys(data[vtuber]['daily'])[0]]
                for (let day in dataset) {
                    labels.push(day);
                }
                if (type == 'view') {
                    this.dayViewData.datasets.push(
                        {
                            data: dataset,
                            label: username,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.dayViewData.labels = labels;
                }
                else if (type == 'time') {
                    this.dayTimeData.datasets.push(
                        {
                            data: dataset,
                            label: username,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.dayTimeData.labels = labels;
                }
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
            default:
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
        }
    }

    firstRun(username: string | null) {
        if (username === null) return;
        
        if (this.cache != undefined)
        {
            // Get Data
            this.vtubers.getHist().toPromise().then(data => {
                this.cache = data;

                // Initial placeholder generation
                this.placeholder = this.randomTag();

                let vtuber: any;
                for (let streamer in this.cache) {
                    if (streamer == username) {
                        vtuber = this.cache[streamer];
                    }
                }
                // Sort data
                for (let year in vtuber) {
                    for (let month in vtuber[year]) {
                        let monthInt = new Date(Date.parse(month +" 1, 2012")).getMonth()+1;
                        let id = monthInt.toString() + '/' + year.toString();
                        // Set up pseudo-dictionaries
                        this.view[vtuber] = { [month]: [], ['daily']: {} };
                        this.time[vtuber] = { [month]: [], ['daily']: {} };
                        // Plug in data
                        this.view[vtuber][month].push(vtuber[year][month]['monthly_view_avg']);
                        this.view[vtuber]['daily'][id] = vtuber[year][month]['daily_view_avg'];
                        this.time[vtuber][month].push(vtuber[year][month]['monthly_time_avg']);
                        this.time[vtuber]['daily'][id] = vtuber[year][month]['daily_time'];
                    }
                }
                // Generate datasets
                this.generateDataSet(this.view, 'view', 'month', vtuber, username);
                this.generateDataSet(this.view, 'view', 'day', vtuber, username);
                this.generateDataSet(this.time, 'time', 'month', vtuber, username);
                this.generateDataSet(this.time, 'time', 'day', vtuber, username);
            });
        }
        // Work with cache
        else {
            let vtuber: any;
            for (let streamer in this.cache) {
                if (streamer == username) {
                    vtuber = this.cache[streamer];
                }
            }
            // Sort data
            for (let year in vtuber) {
                for (let month in vtuber[year]) {
                    let monthInt = new Date(Date.parse(month +" 1, 2012")).getMonth()+1;
                    let id = monthInt.toString() + '/' + year.toString();
                    // Set up pseudo-dictionaries
                    this.view[vtuber] = { [month]: [], ['daily']: {} };
                    this.time[vtuber] = { [month]: [], ['daily']: {} };
                    // Plug in data
                    this.view[vtuber][month].push(vtuber[year][month]['monthly_view_avg']);
                    this.view[vtuber]['daily'][id] = vtuber[year][month]['daily_view_avg'];
                    this.time[vtuber][month].push(vtuber[year][month]['monthly_time_avg']);
                    this.time[vtuber]['daily'][id] = vtuber[year][month]['daily_time'];
                }
            }
            // Generate datasets
            this.generateDataSet(this.view, 'view', 'month', vtuber, username);
            this.generateDataSet(this.view, 'view', 'day', vtuber, username);
            this.generateDataSet(this.time, 'time', 'month', vtuber, username);
            this.generateDataSet(this.time, 'time', 'day', vtuber, username);
        }
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        this.pageTitle += ': ' + id;
        this.firstRun(id);
    }

    public chartHovered({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
        //console.log(event, active);
    }
    public chartClicked({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
        console.log(event, active);
    }

}
